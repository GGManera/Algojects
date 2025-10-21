"use client";

import { useState, useEffect } from 'react';
import { fetchAssetHolders } from '@/lib/allo';

export function useProjectAssetHolders(assetId: number | undefined, round: number | undefined) {
  const [holdings, setHoldings] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assetId || !round) {
      setHoldings(new Map());
      setLoading(false);
      return;
    }

    let isMounted = true;

    const getHolders = async () => {
      if (isMounted) {
        setLoading(true);
        setError(null);
      }
      try {
        const holdersMap = await fetchAssetHolders(assetId, round);
        if (isMounted) {
          setHoldings(holdersMap);
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getHolders();

    return () => {
      isMounted = false;
    };
  }, [assetId, round]);

  return { holdings, loading, error };
}