"use client";

import { useState, useEffect } from 'react';
import { nfdLookupCache, NFD_RESOLVER_CACHE_DURATION_MS } from './useNfdResolver';
import { queueNfdResolutionV2 } from './useNfdBatcher';

interface NfdData {
  name: string | null;
  avatar: string | null;
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

    // 1. Check shared cache first.
    const cachedNfdEntry = nfdLookupCache.get(trimmedAddress);
    const isTimestampFresh = cachedNfdEntry && (Date.now() - cachedNfdEntry.timestamp < NFD_RESOLVER_CACHE_DURATION_MS);
    // Check for a field that was added in the new version to detect old cache entries.
    const isCacheStructureNew = cachedNfdEntry && typeof cachedNfdEntry.bio !== 'undefined';

    if (isTimestampFresh && isCacheStructureNew) {
      // Cache is fresh and has the new data structure.
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

    // If cache is stale, old, or doesn't exist, initiate fetch.
    setLoading(true);
    setNfd(null);
    setRawData(null);

    const fetchNfd = async () => {
      try {
        const result = await queueNfdResolutionV2(trimmedAddress);
        setNfd(result);
        setRawData(result);
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