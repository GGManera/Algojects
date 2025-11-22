"use client";

import { useState, useEffect, useCallback } from 'react';
import { ProjectsData, Review, Comment, Reply, ProposedNoteEdit } from '@/types/social';
import { PROTOCOL_ADDRESS } from '@/lib/social';
import { retryFetch } from '@/utils/api'; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

const SOCIAL_CACHE_KEY = 'socialDataCache';
const SOCIAL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in miliseconds

interface CachedSocialData {
  timestamp: number;
  data: ProjectsData;
}

const decodeNote = (note: string): string => {
  try {
    const binaryString = atob(note);
    const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    console.warn("[useSocialData] Failed to decode note (might not be base64 or invalid UTF-8):", note, e);
    return "";
  }
};

function ensureInteractionDataTypes<T extends { likes: Set<string> | any, likeHistory: any, likeCount: number, isExcluded: boolean }>(item: T): T {
  item.likeHistory = Array.isArray(item.likeHistory) ? item.likeHistory : [];
  const currentLikes = new Set<string>();
  const latestActionPerUser = new Map<string, 'LIKE' | 'UNLIKE'>();
  item.likeHistory.forEach(event => {
    latestActionPerUser.set(event.sender, event.action);
  });
  latestActionPerUser.forEach((action, sender) => {
    if (action === 'LIKE') {
      currentLikes.add(sender);
    } else {
      currentLikes.delete(sender);
    }
  });
  item.likes = currentLikes;
  item.likeCount = currentLikes.size;
  return item;
}

const recursivelyConvertLikes = (data: ProjectsData): ProjectsData => {
  const convertedData: ProjectsData = {};
  for (const projectId in data) {
    const project = { ...data[projectId] };
    project.reviews = {};
    for (const reviewId in data[projectId].reviews || {}) { // Added || {}
      const review = ensureInteractionDataTypes({ ...data[projectId].reviews[reviewId] });
      review.comments = {};
      for (const commentId in data[projectId].reviews[reviewId].comments || {}) { // Added || {}
        const comment = ensureInteractionDataTypes({ ...data[projectId].reviews[reviewId].comments[commentId] });
        comment.replies = {};
        for (const replyId in data[projectId].reviews[reviewId].comments[commentId].replies || {}) { // Added || {}
          const reply = ensureInteractionDataTypes({ ...data[projectId].reviews[reviewId].comments[commentId].replies[replyId] });
          comment.replies[replyId] = reply;
        }
        review.comments[commentId] = comment;
      }
      project.reviews[reviewId] = review;
    }
    convertedData[projectId] = project;
  }
  return convertedData;
};

const parseTransactions = (transactions: any[], latestConfirmedRound: number): ProjectsData => {
    const parsedProjects: ProjectsData = {};
    const multiPartContent: { [key: string]: { [order: number]: string } } = {};
    const projectFirstReviewSender: { [projectId: string]: { sender: string, timestamp: number } } = {};
    const itemLikeEvents: { [itemId: string]: Array<{ sender: string; action: 'LIKE' | 'UNLIKE'; timestamp: number; txId: string }> } = {};
    
    console.log("[useSocialData] Starting parseTransactions with total transactions:", transactions.length, "Snapshot Round:", latestConfirmedRound);

    for (const tx of transactions) {
        if (!tx.note) {
            // console.log("[useSocialData] Skipping transaction without note:", tx.id);
            continue;
        }
        const noteContent = decodeNote(tx.note);
        
        // Match the identifier (everything before the first space) and the rest (content/action)
        const match = noteContent.match(/^([^ ]+) (.*)/s);
        if (!match) {
            // Check for 0-ALGO data transactions like CLAIM or ACCEPT
            const dataMatch = noteContent.match(/^(CLAIM|ACCEPT)\.([^.]+)\.([^.]+)/);
            if (dataMatch) {
                // These are processed later if needed, but we skip them here as they don't define content/likes
            }
            continue;
        }

        const identifier = match[1]; // e.g., h.p1.a.0.1.1.0 or h.p1.a.0
        let contentOrAction = match[2]; // e.g., LIKE or actual content or META {...}

        // --- 1. Parse Interaction Posts (Reviews, Comments, Replies) ---
        // Check if it's a standard interaction post (7 parts max, not LIKE/UNLIKE, not META)
        const parts = identifier.split('.');
        const isInteractionPost = parts.length >= 5 && parts.length <= 7 && !['LIKE', 'UNLIKE'].includes(contentOrAction) && !contentOrAction.startsWith('META');

        if (isInteractionPost) {
            const proj = parts[1];
            const review = parts[2];
            let comm = '0', rep = '0', ver, ord;

            if (parts.length === 5) { [ver, ord] = [parts[3], parts[4]]; }
            else if (parts.length === 6) { [comm, ver, ord] = [parts[3], parts[4], parts[5]]; }
            else if (parts.length === 7) { [comm, rep, ver, ord] = [parts[3], parts[4], parts[5], parts[6]]; }
            else { continue; }

            const version = parseInt(ver, 10);
            const order = parseInt(ord, 10);
            if (isNaN(version) || isNaN(order)) {
                console.warn(`[useSocialData] Invalid version or order for interaction identifier: ${identifier}`);
                continue;
            }

            if (!parsedProjects[proj]) parsedProjects[proj] = { id: proj, reviews: {}, proposedNoteEdits: {} };
            if (review !== '0' && !parsedProjects[proj].reviews[review]) parsedProjects[proj].reviews[review] = { id: `${proj}.${review}`, sender: '', content: '', timestamp: 0, txId: '', latestVersion: -1, likes: new Set(), likeCount: 0, comments: {}, likeHistory: [], isExcluded: false };
            if (comm !== '0' && review !== '0' && !parsedProjects[proj].reviews[review]?.comments[comm]) parsedProjects[proj].reviews[review].comments[comm] = { id: `${proj}.${review}.${comm}`, sender: '', content: '', timestamp: 0, txId: '', latestVersion: -1, likes: new Set(), likeCount: 0, replies: {}, likeHistory: [], isExcluded: false };
            if (rep !== '0' && comm !== '0' && review !== '0' && !parsedProjects[proj].reviews[review]?.comments[comm]?.replies[rep]) parsedProjects[proj].reviews[review].comments[comm].replies[rep] = { id: `${proj}.${review}.${comm}.${rep}`, sender: '', content: '', timestamp: 0, txId: '', latestVersion: -1, likes: new Set(), likeCount: 0, likeHistory: [], isExcluded: false };

            const updateInteraction = (interaction: Review | Comment | Reply) => {
                // Only update if this transaction is for a newer version or the same version but a later part
                if (version > interaction.latestVersion || (version === interaction.latestVersion && order > (multiPartContent[`${interaction.id}.${version}`]?.[order] ? order : -1))) {
                    const versionedId = `${interaction.id}.${version}`;
                    
                    // If it's a new version, clear previous parts and reset exclusion status
                    if (version > interaction.latestVersion) {
                        multiPartContent[versionedId] = {};
                        interaction.content = '';
                        interaction.isExcluded = false; 
                    }
                    
                    interaction.latestVersion = version;
                    interaction.sender = tx.sender;
                    interaction.timestamp = tx['round-time'];
                    interaction.txId = tx.id;
                    
                    if (!multiPartContent[versionedId]) {
                        multiPartContent[versionedId] = {};
                    }
                    multiPartContent[versionedId][order] = contentOrAction;

                    // Check if this chunk marks the post as excluded
                    if (contentOrAction === 'EXCLUDE') {
                        interaction.isExcluded = true;
                        multiPartContent[versionedId] = { 0: 'EXCLUDE' }; 
                    } else if (interaction.isExcluded && version === interaction.latestVersion) {
                        interaction.isExcluded = false;
                    }
                }
            };
            
            if (rep !== '0') updateInteraction(parsedProjects[proj].reviews[review].comments[comm].replies[rep]);
            else if (comm !== '0') updateInteraction(parsedProjects[proj].reviews[review].comments[comm]);
            else if (review !== '0') updateInteraction(parsedProjects[proj].reviews[review]);

            if (review === 'a' && comm === '0' && rep === '0') {
                if (!projectFirstReviewSender[proj] || tx['round-time'] < projectFirstReviewSender[proj].timestamp) {
                    projectFirstReviewSender[proj] = { sender: tx.sender, timestamp: tx['round-time'] };
                }
            }
        } 
        // --- 2. Parse Like/Unlike Events ---
        else if (tx['payment-transaction'] && ['LIKE', 'UNLIKE'].includes(contentOrAction)) {
            // Identifier format: [Hash].[ItemId].[Version]
            const idParts = identifier.split('.');
            // ItemId is parts[1] to parts[length-2]
            const itemId = idParts.slice(1, idParts.length - 1).join('.'); 
            if (!itemLikeEvents[itemId]) itemLikeEvents[itemId] = [];
            itemLikeEvents[itemId].push({ sender: tx.sender, action: contentOrAction as 'LIKE' | 'UNLIKE', timestamp: tx['round-time'], txId: tx.id });
        }
        // --- 3. Parse Metadata Suggestion (META) ---
        else if (contentOrAction.startsWith('META')) {
            // Identifier format: [Hash].[Proj].[EditId].[Order]
            const metaParts = identifier.split('.');
            
            // Ensure we have 4 parts (Hash.Proj.EditId.Order)
            if (metaParts.length === 4) { 
                const proj = metaParts[1];
                const editId = metaParts[2];
                const order = parseInt(metaParts[3], 10); // Order is the last part of the identifier

                // Extract the actual JSON content by removing "META " from the start of contentOrAction
                const jsonContent = contentOrAction.substring(5).trim();

                if (isNaN(order)) continue;
                
                if (!parsedProjects[proj]) parsedProjects[proj] = { id: proj, reviews: {}, proposedNoteEdits: {} };
                
                // NEW: Prefix the full ID with 'S-' to prevent collision with review/comment IDs
                const prefixedEditId = `S-${editId}`;
                const fullEditId = `${proj}.${prefixedEditId}`;
                
                if (!parsedProjects[proj].proposedNoteEdits[prefixedEditId]) {
                    parsedProjects[proj].proposedNoteEdits[prefixedEditId] = {
                        id: fullEditId,
                        projectId: proj,
                        sender: tx.sender,
                        content: '',
                        timestamp: tx['round-time'],
                        txId: tx.id,
                        latestVersion: 1, // Suggestions are always version 1
                        likes: new Set(),
                        likeCount: 0,
                        likeHistory: [],
                        isExcluded: false,
                        status: 'pending', // Default status
                    };
                }
                
                const suggestion = parsedProjects[proj].proposedNoteEdits[prefixedEditId];
                const versionedId = `${suggestion.id}.1`; // Suggestions are always version 1
                
                if (!multiPartContent[versionedId]) {
                    multiPartContent[versionedId] = {};
                }
                multiPartContent[versionedId][order] = jsonContent; // Store the JSON chunk
                
                // Update metadata fields (sender, timestamp, txId) only if this is the latest transaction for this editId
                if (tx['round-time'] > suggestion.timestamp) {
                    suggestion.sender = tx.sender;
                    suggestion.timestamp = tx['round-time'];
                    suggestion.txId = tx.id;
                }
            }
        }
    }

    // --- Phase 2: Assemble Content and Process Likes ---
    
    // 1. Assemble Interaction Content
    Object.values(parsedProjects).forEach(proj => {
        Object.values(proj.reviews).forEach(review => {
            const assemble = (interaction: Review | Comment | Reply | ProposedNoteEdit) => {
                if (interaction.isExcluded) {
                    interaction.content = "[EXCLUDED]";
                    return;
                }
                
                const versionedId = `${interaction.id}.${interaction.latestVersion}`;
                if (multiPartContent[versionedId]) {
                    // Ensure content is assembled correctly
                    interaction.content = Object.keys(multiPartContent[versionedId]).map(Number).sort((a, b) => a - b).map(key => multiPartContent[versionedId][key]).join('');
                } else {
                    interaction.content = "";
                }
            };
            assemble(review);
            Object.values(review.comments).forEach(comment => {
                assemble(comment);
                Object.values(comment.replies).forEach(reply => assemble(reply));
            });
            
            // Assemble Proposed Edits Content
            Object.values(proj.proposedNoteEdits).forEach(suggestion => assemble(suggestion));
        });
    });
    
    // 2. Process Likes (unchanged)
    Object.values(parsedProjects).forEach(proj => {
        Object.values(proj.reviews).forEach(review => {
            const processInteraction = (interaction: Review | Comment | Reply) => {
                const history = (itemLikeEvents[interaction.id] || []).sort((a, b) => a.timestamp - b.timestamp);
                interaction.likeHistory = history;
                const currentLikes = new Set<string>();
                const latestActionPerUser = new Map<string, 'LIKE' | 'UNLIKE'>();
                history.forEach(event => latestActionPerUser.set(event.sender, event.action));
                latestActionPerUser.forEach((action, sender) => {
                    if (action === 'LIKE') currentLikes.add(sender);
                });
                interaction.likes = currentLikes;
                interaction.likeCount = currentLikes.size;
            };
            processInteraction(review);
            Object.values(review.comments).forEach(comment => {
                processInteraction(comment);
                Object.values(comment.replies).forEach(reply => processInteraction(reply));
            });
        });
    });

    // --- Phase 3: Final Cleanup and Metadata ---
    Object.values(parsedProjects).forEach(proj => {
        if (projectFirstReviewSender[proj.id]) proj.creatorWallet = projectFirstReviewSender[proj.id].sender;
        
        // Set the round number for the project
        proj.round = latestConfirmedRound || 30000000; 

        const filteredReviews: { [reviewId: string]: Review } = {};
        Object.values(proj.reviews).forEach(review => {
            if (review.content.trim() !== "" && !review.isExcluded) {
                filteredReviews[review.id.split('.')[1]] = review;
            }
        });
        proj.reviews = filteredReviews;
        
        // Filter out empty/invalid proposed edits
        const filteredEdits: { [editId: string]: ProposedNoteEdit } = {};
        Object.values(proj.proposedNoteEdits).forEach(edit => {
            // The key in proposedNoteEdits is the prefixed ID (e.g., S-a)
            if (edit.content.trim() !== "") {
                // Keep the prefixed ID as the key in the final map
                const prefixedId = edit.id.split('.')[1];
                filteredEdits[prefixedId] = edit;
            }
        });
        proj.proposedNoteEdits = filteredEdits;
    });

    console.log("[useSocialData] Finished parseTransactions. Latest Confirmed Round:", latestConfirmedRound, "Resulting projects:", parsedProjects);
    return parsedProjects;
};

export function useSocialData() {
  const [projects, setProjects] = useState<ProjectsData>({});
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const refetch = useCallback(() => {
    // When refetch is called, we want to show a loading state immediately.
    // If there's existing data, it will be a refresh. If not, it's a full load.
    setLoading(true); // Assume full loading until cache check
    setIsRefreshing(true); // Assume refreshing in background
    localStorage.removeItem(SOCIAL_CACHE_KEY); // Clear cache to force fresh fetch
    setRefetchTrigger(prev => prev + 1); // Trigger useEffect
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setError(null);
      let cacheUsed = false;
      let isCacheStale = true;

      const cachedItem = localStorage.getItem(SOCIAL_CACHE_KEY);
      if (cachedItem) {
        try {
          const cachedData: CachedSocialData = JSON.parse(cachedItem);
          isCacheStale = Date.now() - cachedData.timestamp > SOCIAL_CACHE_DURATION;

          setProjects(recursivelyConvertLikes(cachedData.data)); // Display cached data immediately
          cacheUsed = true;
          setLoading(false); // Data is available, so not "loading" in the sense of no data
          
          if (!isCacheStale) {
            // Cache is fresh, no need to fetch from API
            setIsRefreshing(false); // If cache is fresh, no background refresh needed
            console.log("[SocialData] Using fresh cached data, skipping API fetch.");
            return; // Exit early, no API call needed
          }
          // Cache is stale, proceed to fetch in background. isRefreshing is already true from refetch or will be set below.
          console.log("[SocialData] Cached data is stale, initiating background refresh.");
        } catch (e) {
          console.error("[SocialData] Failed to parse social data cache, fetching new data.", e);
          localStorage.removeItem(SOCIAL_CACHE_KEY); // Clear invalid cache
          // Fall through to fetch new data, setLoading will be true below
        }
      }

      // If no cache was used, or cache was invalid, or cache was stale, we need to fetch
      if (!cacheUsed || isCacheStale) {
        if (!cacheUsed) { // Only show full loading spinner if no data is available at all
          setLoading(true);
        }
        setIsRefreshing(true); // Always set refreshing to true if a fetch is initiated

        try {
          let allTransactions: any[] = [];
          let nextToken: string | undefined = undefined; // Always start with no nextToken for a full fetch
          const afterTime = new Date("2024-01-01T00:00:00Z").toISOString(); // Start from a fixed historical point
          let latestConfirmedRound = 0; // Initialize here to capture current-round

          console.log("[SocialData] Starting full data fetch from Indexer.");

          do {
            let url = `${INDEXER_URL}/v2/accounts/${PROTOCOL_ADDRESS}/transactions?after-time=${afterTime}`;
            if (nextToken) {
              url += `&next=${nextToken}`;
            }
            
            console.log(`[SocialData] Fetching transactions from: ${url}`);
            const response = await retryFetch(url, undefined, 5); // Increased retries
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Indexer API responded with status ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const fetchedTransactions = data.transactions || [];
            allTransactions = allTransactions.concat(fetchedTransactions);
            nextToken = data['next-token'];
            
            // Capture the latest current-round reported by the indexer
            if (data['current-round'] && data['current-round'] > latestConfirmedRound) {
                latestConfirmedRound = data['current-round'];
            }
            
            console.log(`[SocialData] Fetched ${fetchedTransactions.length} transactions. Next token: ${nextToken || 'none'}. Total so far: ${allTransactions.length}`);

          } while (nextToken);

          console.log(`[SocialData] Finished fetching all transactions. Total: ${allTransactions.length}`);
          
          // Pass the captured latestConfirmedRound to parseTransactions
          const parsedProjects = parseTransactions(allTransactions, latestConfirmedRound);
          setProjects(parsedProjects);

          const newCache: CachedSocialData = {
            timestamp: Date.now(),
            data: parsedProjects,
          };
          localStorage.setItem(SOCIAL_CACHE_KEY, JSON.stringify(newCache));
          
        } catch (err) {
          console.error("[SocialData] Failed to fetch social data:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
        } finally {
          setLoading(false);
          setIsRefreshing(false);
        }
      }
    };

    fetchData();
  }, [refetchTrigger]);

  return { projects, loading, isRefreshing, error, refetch };
}