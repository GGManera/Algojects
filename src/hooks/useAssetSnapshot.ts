"use client";

import { useState, useEffect, useMemo } from 'react';
import { retryFetch } from '@/utils/api';

const ALLO_ANALYTICS_API_URL = "https://analytics-api.allo.info";

interface AssetSnapshotData {
  amount: number; // The balance of the asset at the specified round
  loading: boolean;
  error: string | null;
}

const SNAPSHOT_CACHE_KEY_PREFIX = 'assetSnapshotCache_';
const SNAPSHOT_CACHE_DURATION = 60 * 60 * 1000; // 1 hour, since this is historical data

interface CachedSnapshot {
  timestamp: number;
  amount: number;
}

/**
 * Fetches the balance of a specific asset for a specific address at a specific round
 * using the Allo Analytics API.
 */
export function useAssetSnapshot(address: string | undefined, assetId: number | undefined, round: number | null): AssetSnapshotData {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => {
    if (address && assetId && round) {
      return `${SNAPSHOT_CACHE_KEY_PREFIX}${address}_${assetId}_${round}`;
    }
    return null;
  }, [address, assetId, round]);

  useEffect(() => {
    if (!address || !assetId || isNaN(assetId) || assetId <= 0 || !round) {
      setAmount(0);
      setLoading(false);
      setError(null);
      return;
    }

    const fetchData = async () => {
      let cacheUsed = false;
      let isCacheStale = true;

      if (cacheKey) {
        const cachedItem = localStorage.getItem(cacheKey);
        if (cachedItem) {
          try {
            const cachedData: CachedSnapshot = JSON.parse(cachedItem);
            isCacheStale = Date.now() - cachedData.timestamp > SNAPSHOT_CACHE_DURATION;
            setAmount(cachedData.amount);
            cacheUsed = true;
            setLoading(false);
            if (!isCacheStale) return;
          } catch (e) {
            localStorage.removeItem(cacheKey);
          }
        }
      }

      if (!cacheUsed || isCacheStale) {
        if (!cacheUsed) setLoading(true);
        setError(null);
        try {
          const url = `${ALLO_ANALYTICS_API_URL}/v1/asset/${assetId}/snapshot/${round}`;
          
          const response = await retryFetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Allo Analytics API responded with status ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          
          // The API returns a list of holders. We need to find the specific address.
          const holderEntry = data.holders.find((holder: any) => holder.address === address);
          const holdingAmount = holderEntry?.amount || 0;
          
          setAmount(holdingAmount);

          if (cacheKey) {
            localStorage.setItem(cacheKey, JSON.stringify({ amount: holdingAmount, timestamp: Date.now() }));
          }
        } catch (err) {
          console.error(`Failed to fetch asset snapshot for ${address} asset ${assetId} at round ${round}:`, err);
          setError(err instanceof Error ? err.message : "Failed to fetch snapshot.");
          setAmount(0);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [address, assetId, round, cacheKey]);

  return { amount, loading, error };
}