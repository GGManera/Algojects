"use client";

import { useState, useEffect, useMemo } from 'react';
import { fetchAccountAssetHoldings } from '@/utils/algorand';

interface AssetHoldingData {
  amount: number;
  loading: boolean;
  error: string | null;
}

const ASSET_HOLDING_CACHE_KEY_PREFIX = 'assetHoldingCache_';
const ASSET_HOLDING_CACHE_DURATION = 30 * 1000; // 30 seconds

export function useUserAssetHolding(address: string | undefined, assetId: number | undefined): AssetHoldingData {
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => {
    if (address && assetId) {
      return `${ASSET_HOLDING_CACHE_KEY_PREFIX}${address}_${assetId}`;
    }
    return null;
  }, [address, assetId]);

  useEffect(() => {
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
  }, [address, assetId, cacheKey]);

  return { amount, loading, error };
}