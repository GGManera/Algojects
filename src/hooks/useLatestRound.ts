"use client";

import { useState, useEffect, useCallback } from 'react';
import { retryFetch } from '@/utils/api';

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";
const ROUND_CACHE_KEY = 'latestRoundCache';
const ROUND_CACHE_DURATION = 15 * 1000; // 15 seconds

interface LatestRoundData {
  round: number | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

interface CachedRound {
  timestamp: number;
  round: number;
}

export function useLatestRound(): LatestRoundData {
  const [round, setRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTrigger, setRefetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    let cacheUsed = false;
    let isCacheStale = true;

    const cachedItem = localStorage.getItem(ROUND_CACHE_KEY);
    if (cachedItem) {
      try {
        const cachedData: CachedRound = JSON.parse(cachedItem);
        isCacheStale = Date.now() - cachedData.timestamp > ROUND_CACHE_DURATION;
        setRound(cachedData.round);
        cacheUsed = true;
        setLoading(false);
        if (!isCacheStale) return;
      } catch (e) {
        localStorage.removeItem(ROUND_CACHE_KEY);
      }
    }

    if (!cacheUsed || isCacheStale) {
      if (!cacheUsed) setLoading(true);
      setError(null);
      try {
        const indexerStatusResponse = await retryFetch(`${INDEXER_URL}/v2/transactions?limit=1`);
        if (!indexerStatusResponse.ok) throw new Error("Could not fetch network status from Indexer.");
        const indexerStatusData = await indexerStatusResponse.json();
        const lastRound = indexerStatusData['current-round'];
        
        if (typeof lastRound !== 'number') throw new Error("Could not get last round from the network.");

        setRound(lastRound);
        localStorage.setItem(ROUND_CACHE_KEY, JSON.stringify({ round: lastRound, timestamp: Date.now() }));

      } catch (err) {
        console.error("[useLatestRound] Failed to fetch latest round:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
        setRound(null);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refetchTrigger]);

  const refetch = useCallback(() => {
    localStorage.removeItem(ROUND_CACHE_KEY);
    setRefetchTrigger(prev => prev + 1);
  }, []);

  return { round, loading, error, refetch };
}