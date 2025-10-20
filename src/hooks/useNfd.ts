"use client";

import { useState, useEffect } from 'react';

// Cache simples na memória para armazenar dados de NFD e evitar chamadas repetidas
// Import the shared cache map from useNfdResolver
import { nfdLookupCache } from './useNfdResolver';

interface NfdData {
  name: string | null;
  avatar: string | null;
}

const NFD_API_URL = "https://api.nf.domains";
const NFD_CACHE_DURATION_MS = 15 * 1000; // 15 seconds for NFD cache

// NEW: Global map to hold pending fetch promises for deduplication
const pendingRequests = new Map<string, Promise<any>>();

const ipfsToGateway = (url: string | undefined): string | null => {
  if (!url) return null;

  // If it's already a direct HTTP/HTTPS URL, use it as is.
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // If it's an IPFS URI, convert it to the Pera gateway.
  if (url.startsWith("ipfs://")) {
    const hash = url.substring("ipfs://".length);
    return `https://ipfs-pera.algonode.dev/ipfs/${hash}`;
  }

  // For any other format, return null
  return null;
};

// Helper function to process raw NFD data into NfdData structure
const processNfdData = (data: any, address: string): NfdData => {
    const nfdData = data[address] || data; // Handle both batched (keyed by address) and single lookups
    
    // Prioritize verified avatar if available, otherwise use userDefined
    const rawAvatarUrl = nfdData?.properties?.verified?.avatar || nfdData?.properties?.userDefined?.avatar;
    const avatarUrl = ipfsToGateway(rawAvatarUrl);

    let nfdName = nfdData?.name || null;
    if (nfdName && !nfdName.endsWith(".algo")) {
      nfdName = `${nfdName}.algo`;
    }

    return {
      name: nfdName,
      avatar: avatarUrl,
    };
};


export function useNfd(address: string | undefined) {
  const [nfd, setNfd] = useState<NfdData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any>(null);

  useEffect(() => {
    if (!address) {
      setNfd(null);
      setRawData(null);
      setLoading(false);
      return;
    }
    
    const trimmedAddress = address.trim();

    // 1. Check shared cache first. If found and fresh, update state and return early.
    const cachedNfdEntry = nfdLookupCache.get(trimmedAddress);
    const isFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_CACHE_DURATION_MS);

    if (isFresh) {
      setNfd(cachedNfdEntry);
      setRawData(cachedNfdEntry);
      setLoading(false);
      return;
    }

    // 2. Check if a request is already pending for this address
    if (pendingRequests.has(trimmedAddress)) {
        setLoading(true);
        // Wait for the existing request to complete
        pendingRequests.get(trimmedAddress)!.then((result) => {
            setNfd(result);
            setRawData(result);
            setLoading(false);
        }).catch((err) => {
            console.error(`[useNfd] Pending request failed for ${trimmedAddress}:`, err);
            setNfd({ name: null, avatar: null });
            setRawData({ error: err instanceof Error ? err.message : "Unknown error" });
            setLoading(false);
        });
        return;
    }

    // 3. Initiate a new fetch
    setLoading(true);
    setNfd(null);
    setRawData(null);

    const fetchNfd = async () => {
      try {
        const response = await fetch(`${NFD_API_URL}/nfd/lookup?address=${trimmedAddress}&view=full`);
        
        if (response.status === 404) {
          const data = { name: null, avatar: null, address: trimmedAddress, timestamp: Date.now() };
          nfdLookupCache.set(trimmedAddress, data);
          return data;
        }

        if (!response.ok) {
          throw new Error(`A API respondeu com o status ${response.status}`);
        }

        const data = await response.json();
        const result: NfdData = processNfdData(data, trimmedAddress);
        
        const cachedResult = { ...result, address: trimmedAddress, timestamp: Date.now() };
        nfdLookupCache.set(trimmedAddress, cachedResult);
        return cachedResult;
      } catch (err) {
        console.error(`[useNfd] Falha ao buscar NFD para ${trimmedAddress}:`, err);
        const data = { name: null, avatar: null, address: trimmedAddress, timestamp: Date.now() };
        nfdLookupCache.set(trimmedAddress, data);
        throw err; // Re-throw the error to be caught by the promise chain
      } finally {
        pendingRequests.delete(trimmedAddress); // Remove from pending map regardless of success/failure
      }
    };

    const requestPromise = fetchNfd();
    pendingRequests.set(trimmedAddress, requestPromise);

    requestPromise.then((result) => {
        setNfd(result);
        setRawData(result);
    }).catch((err) => {
        setNfd({ name: null, avatar: null });
        setRawData({ error: err instanceof Error ? err.message : "Unknown error" });
    }).finally(() => {
        setLoading(false);
    });

  }, [address]);

  return { nfd, loading, rawData };
}