"use client";

import { useState, useEffect } from 'react';

// Cache simples na memória para armazenar dados de NFD e evitar chamadas repetidas
// Import the shared cache map from useNfdResolver
import { nfdLookupCache } from './useNfdResolver';
import { queueNfdResolutionV2 } from './useNfdBatcher'; // NEW: Import the batcher

interface NfdData {
  name: string | null;
  avatar: string | null;
}

const NFD_CACHE_DURATION_MS = 15 * 1000; // 15 seconds for NFD cache

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

    // 2. Initiate fetch via the batcher
    setLoading(true);
    setNfd(null);
    setRawData(null);

    const fetchNfd = async () => {
      try {
        // Use the batcher to queue the request
        const result = await queueNfdResolutionV2(trimmedAddress);
        
        setNfd(result);
        setRawData(result); // Raw data is now the processed result from the batcher
      } catch (err) {
        console.error(`[useNfd] Falha ao buscar NFD para ${trimmedAddress}:`, err);
        setNfd({ name: null, avatar: null });
        setRawData({ error: err instanceof Error ? err.message : "Unknown error" });
      } finally {
        setLoading(false);
      }
    };

    fetchNfd();
  }, [address]);

  return { nfd, loading, rawData };
}