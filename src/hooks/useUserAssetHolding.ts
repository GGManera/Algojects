"use client";

import { useState, useEffect, useMemo } from 'react';
import { fetchAccountAssetHoldings } from '@/utils/algorand';
import { useAssetSnapshot } from './useAssetSnapshot'; // Import the new snapshot hook

interface AssetHoldingData {
  amount: number;
  loading: boolean;
  error: string | null;
}

const ASSET_HOLDING_CACHE_KEY_PREFIX = 'assetHoldingCache_';
const ASSET_HOLDING_CACHE_DURATION = 30 * 1000; // 30 seconds

export function useUserAssetHolding(address: string | undefined, assetId: number | undefined, round: number | null = null): AssetHoldingData {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use the snapshot hook if a round is provided
  const { 
    amount: snapshotAmount, 
    loading: snapshotLoading, 
    error: snapshotError 
  } = useAssetSnapshot(address, assetId, round);

  const cacheKey = useMemo(() => {
    // Cache key only for live data fetches (when round is null)
    if (address && assetId && round === null) {
      return `${ASSET_HOLDING_CACHE_KEY_PREFIX}${address}_${assetId}`;
    }
    return null;
  }, [address, assetId, round]);

  useEffect(() => {
    // If round is provided, we rely entirely on the snapshot hook
    if (round !== null) {
      setAmount(snapshotAmount);
      setLoading(snapshotLoading);
      setError(snapshotError);
      return;
    }

    // --- Fallback to Live Indexer Data (Original Logic) ---
    if (!address || !assetId || isNaN(assetId) || assetId <= 0) {
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
            const cachedData = JSON.parse(cachedItem);
            isCacheStale = Date.now() - cachedData.timestamp > ASSET_HOLDING_CACHE_DURATION;
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
          // fetchAccountAssetHoldings returns a Map<assetId, amount>
          const holdingsMap = await fetchAccountAssetHoldings(address, [assetId]);
          const holdingAmount = holdingsMap.get(assetId) || 0;
          setAmount(holdingAmount);

          if (cacheKey) {
            localStorage.setItem(cacheKey, JSON.stringify({ amount: holdingAmount, timestamp: Date.now() }));
          }
        } catch (err) {
          console.error(`Failed to fetch holding for ${address} asset ${assetId}:`, err);
          setError(err instanceof Error ? err.message : "Failed to fetch holding.");
          setAmount(0);
        } finally {
          setLoading(false);
        }
      }
    };

    fetchData();
  }, [address, assetId, cacheKey, round, snapshotAmount, snapshotLoading, snapshotError]);

  // Return the state based on whether snapshot is active or live data is being used
  if (round !== null) {
    return { amount: snapshotAmount, loading: snapshotLoading, error: snapshotError };
  }
  return { amount, loading, error };
}