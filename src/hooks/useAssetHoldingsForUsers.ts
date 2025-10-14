"use client";

import { useState, useEffect } from 'react';
import { fetchAccountAssetHoldings } from '@/utils/algorand';

/**
 * Fetches the holdings of a specific asset ID for a list of Algorand addresses.
 * Returns a Map where keys are addresses and values are the amounts held for the given asset.
 */
export function useAssetHoldingsForUsers(
  addresses: string[] | undefined,
  assetId: number | undefined
) {
  const [holdingsMap, setHoldingsMap] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!addresses || addresses.length === 0 || !assetId || assetId <= 0) {
      setHoldingsMap(new Map());
      setLoading(false);
      return;
    }

    const fetchHoldings = async () => {
      setLoading(true);
      setError(null);
      try {
        const uniqueAddresses = Array.from(new Set(addresses));
        const newHoldingsMap = new Map<string, number>();

        // Fetch holdings for each unique address
        for (const address of uniqueAddresses) {
          const accountHoldings = await fetchAccountAssetHoldings(address, [assetId]);
          newHoldingsMap.set(address, accountHoldings.get(assetId) || 0);
        }
        setHoldingsMap(newHoldingsMap);
      } catch (err) {
        console.error("Error fetching asset holdings for users:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    };

    fetchHoldings();
  }, [addresses, assetId]);

  return { holdingsMap, loading, error };
}