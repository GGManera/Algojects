"use client";

import { useState, useEffect, useCallback } from 'react';
import { fetchProjectDetailsClient, updateProjectDetailsClient } from '@/lib/coda';
import { ProjectDetailsEntry } from '../../api/project-details';
import { useWallet } from '@txnlab/use-wallet-react'; // NEW: Import useWallet
import { ProjectMetadata, MetadataItem } from '@/types/project'; // NEW: Import ProjectMetadata


// Define as constantes do cache
const CACHE_KEY = 'codaProjectDetailsCache';
const CACHE_DURATION = 1 * 60 * 1000; // 1 minuto em milissegundos

interface CachedData {
  timestamp: number;
  data: ProjectDetailsEntry[];
}

export function useProjectDetails() {
  const [projectDetails, setProjectDetails] = useState<ProjectDetailsEntry[]>([]);
  const [loading, setLoading] = useState(true); // True for initial load when no data is available
  const [isRefreshing, setIsRefreshing] = useState(false); // True when background refresh is happening
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const { activeAddress, transactionSigner, algodClient } = useWallet(); // NEW: Get wallet details

  const refetch = useCallback(() => {
    // When refetch is called, we want to show a loading state immediately.
    // If there's existing data, it will be a refresh. If not, it's a full load.
    setLoading(true); // Assume full loading until cache check
    setIsRefreshing(true); // Assume refreshing in background
    localStorage.removeItem(CACHE_KEY); // Clear cache to force fresh fetch
    setRefetchTrigger(prev => prev + 1); // Trigger useEffect
  }, []);

  useEffect(() => {
    const loadProjectDetails = async () => {
      setError(null);
      let cacheUsed = false;
      let isCacheStale = true; // Assume stale until proven fresh

      const cachedItem = localStorage.getItem(CACHE_KEY);
      if (cachedItem) {
        try {
          const cachedData: CachedData = JSON.parse(cachedItem);
          isCacheStale = Date.now() - cachedData.timestamp > CACHE_DURATION;

          setProjectDetails(cachedData.data); // Display cached data immediately
          cacheUsed = true;
          setLoading(false); // Data is available, so not "loading" in the sense of no data
          
          if (!isCacheStale) {
            // Cache is fresh, no need to fetch from API
            setIsRefreshing(false); // If cache is fresh, no background refresh needed
            return; // Exit early, no API call needed
          }
          // Cache is stale, proceed to fetch in background. isRefreshing is already true from refetch or will be set below.
        } catch (e) {
          console.error("Failed to parse cache, fetching new data.", e);
          localStorage.removeItem(CACHE_KEY); // Clear invalid cache
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
          const data = await fetchProjectDetailsClient();
          setProjectDetails(data);
          const newCache: CachedData = {
            timestamp: Date.now(),
            data: data,
          };
          localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
        } catch (err) {
          console.error("Failed to load project details:", err);
          setError(err instanceof Error ? err.message : "An unknown error occurred.");
          // If fetch fails, and we had stale data, we keep showing stale data.
          // If fetch fails and we had no data, error will be displayed.
        } finally {
          setLoading(false); // Ensure loading is false after fetch attempt
          setIsRefreshing(false); // Ensure refreshing is false after fetch attempt
        }
      }
    };

    loadProjectDetails();
  }, [refetchTrigger]);

  const updateProjectDetails = useCallback(async (
    projectId: string, 
    newProjectMetadata: ProjectMetadata // Now takes the full metadata array
  ) => {
    if (!activeAddress || !transactionSigner || !algodClient) { // NEW: Check for wallet connection
      throw new Error("Wallet not connected. Cannot update project details.");
    }
    try {
      await updateProjectDetailsClient(
        projectId, 
        newProjectMetadata, // Pass the full metadata array
        activeAddress, // NEW
        transactionSigner, // NEW
        algodClient // NEW
      );
      // After successful update, force a refetch to get the latest data
      refetch();
    } catch (err) {
      console.error("Failed to update project details:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      throw err;
    }
  }, [activeAddress, transactionSigner, algodClient, refetch]); // NEW: Add wallet dependencies

  const acceptProposedNoteEdit = useCallback(async (
    projectId: string,
    acceptedContent: string,
    acceptedByAddress: string, // The address of the user who proposed this edit
  ) => {
    if (!activeAddress || !transactionSigner || !algodClient) { // NEW: Check for wallet connection
      throw new Error("Wallet not connected. Cannot accept proposed note edit.");
    }
    try {
      const currentDetails = projectDetails.find(pd => pd.projectId === projectId);
      if (!currentDetails) {
        throw new Error(`Project details for ${projectId} not found.`);
      }

      // Find and update the project-description item
      const updatedMetadata = currentDetails.projectMetadata.map(item => {
        if (item.type === 'project-description') {
          return { ...item, value: acceptedContent };
        }
        // Also update is-community-notes and added-by-address
        if (item.type === 'is-community-notes') {
          return { ...item, value: 'true' };
        }
        if (item.type === 'added-by-address') {
          return { ...item, value: acceptedByAddress };
        }
        if (item.type === 'is-creator-added') { // Ensure this is set to false
          return { ...item, value: 'false' };
        }
        return item;
      });

      // Ensure is-community-notes, added-by-address, is-creator-added exist if they don't
      if (!updatedMetadata.some(item => item.type === 'is-community-notes')) {
        updatedMetadata.push({ title: 'Is Community Notes', value: 'true', type: 'is-community-notes' });
      }
      if (!updatedMetadata.some(item => item.type === 'added-by-address')) {
        updatedMetadata.push({ title: 'Added By Address', value: acceptedByAddress, type: 'added-by-address' });
      }
      if (!updatedMetadata.some(item => item.type === 'is-creator-added')) {
        updatedMetadata.push({ title: 'Is Creator Added', value: 'false', type: 'is-creator-added' });
      }


      await updateProjectDetailsClient(
        projectId,
        updatedMetadata, // Pass the updated metadata array
        activeAddress, // NEW
        transactionSigner, // NEW
        algodClient // NEW
      );
      refetch(); // Refetch to get the latest Coda data
    } catch (err) {
      console.error("Failed to accept proposed note edit:", err);
      setError(err instanceof Error ? err.message : "An unknown error occurred.");
      throw err;
    }
  }, [projectDetails, activeAddress, transactionSigner, algodClient, refetch]); // NEW: Add wallet dependencies

  return { projectDetails, loading, isRefreshing, error, refetch, updateProjectDetails, acceptProposedNoteEdit };
}