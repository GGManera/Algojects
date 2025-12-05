"use client";

import { useState, useEffect } from 'react';

// Cache simples na memória para armazenar dados de NFD e evitar chamadas repetidas
// Import the shared cache map from useNfdResolver
import { nfdLookupCache, NFD_RESOLVER_CACHE_DURATION_MS } from './useNfdResolver'; // NEW: Import NFD_RESOLVER_CACHE_DURATION_MS
import { queueNfdResolutionV2 } from './useNfdBatcher'; // NEW: Import the batcher

interface NfdData {
  name: string | null;
  avatar: string | null;
  // NEW: Additional properties
  bio: string | null;
  twitter: string | null;
  discord: string | null;
  blueskydid: string | null;
}

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
    const isFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_RESOLVER_CACHE_DURATION_MS); // Use imported constant

    if (isFresh) {
      // Ensure all new fields are present in the cached entry (for older cache entries)
      const cachedData: NfdData = {
        name: cachedNfdEntry.name,
        avatar: cachedNfdEntry.avatar,
        bio: cachedNfdEntry.bio || null,
        twitter: cachedNfdEntry.twitter || null,
        discord: cachedNfdEntry.discord || null,
        blueskydid: cachedNfdEntry.blueskydid || null,
      };
      setNfd(cachedData);
      setRawData(cachedNfdEntry);
      setLoading(false);
      return;
    }

    // 2. Initiate fetch via the batcher
    setLoading(true);
    setNfd(null);
    setRawData(null);

    const fetchNfd = async () => {
      try {
        // Use the batcher to queue the request
        const result = await queueNfdResolutionV2(trimmedAddress);
        
        // The result from V2 batcher now includes the full NFD data structure
        setNfd(result);
        setRawData(result); // Raw data is now the processed result from the batcher
      } catch (err) {
        console.error(`[useNfd] Falha ao buscar NFD para ${trimmedAddress}:`, err);
        setNfd({ name: null, avatar: null, bio: null, twitter: null, discord: null, blueskydid: null });
        setRawData({ error: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setLoading(false);
      }
    };

    fetchNfd();
  }, [address]);

  return { nfd, loading, rawData };
}