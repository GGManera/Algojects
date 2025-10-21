"use client";

import { useState, useEffect } from 'react';
import { useWallet } from '@txnlab/use-wallet-react';
import { fetchAssetHolders } from '@/lib/allo';

export function useProjectAssetHolders(assetId: number | undefined) {
  const [holdings, setHoldings] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { algodClient } = useWallet();

  useEffect(() => {
    if (!assetId || !algodClient) {
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
        const holdersMap = await fetchAssetHolders(assetId, algodClient);
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
  }, [assetId, algodClient]);

  return { holdings, loading, error };
}