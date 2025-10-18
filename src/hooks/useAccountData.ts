"use client";

import { useState, useEffect, useCallback } from 'react';
import { retryFetch } from '@/utils/api'; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

export interface Transaction {
  id: string;
  'asset-transfer-transaction'?: {
    'asset-id': number;
    amount: number;
    receiver: string;
  };
  'payment-transaction'?: {
    amount: number;
  };
  'round-time': number;
  sender: string;
  'tx-type': string;
}

interface CachedAccountData {
  timestamp: number;
  transactions: Transaction[];
}

const ACCOUNT_DATA_CACHE_KEY_PREFIX = 'accountDataCache_'; // Prefix to store per-address
const ACCOUNT_DATA_CACHE_DURATION = 15 * 1000; // 15 seconds

export function useAccountData(activeAddress: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalRefetchTrigger, setInternalRefetchTrigger] = useState(0); // New trigger for manual refetch

  const fetchData = useCallback(async () => {
    if (!activeAddress) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${ACCOUNT_DATA_CACHE_KEY_PREFIX}${activeAddress}`;
    let cacheUsed = false;
    let isCacheStale = true;

    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      try {
        const cachedData: CachedAccountData = JSON.parse(cachedItem);
        isCacheStale = Date.now() - cachedData.timestamp > ACCOUNT_DATA_CACHE_DURATION;

        setTransactions(cachedData.transactions);
        cacheUsed = true;
        setLoading(false);
        console.log(`[useAccountData] Using cached data for ${activeAddress}.`);

        if (!isCacheStale) {
          console.log(`[useAccountData] Cached data for ${activeAddress} is fresh, skipping API fetch.`);
          return;
        }
        console.log(`[useAccountData] Cached data for ${activeAddress} is stale, initiating background refresh.`);
      } catch (e) {
        console.error(`[useAccountData] Failed to parse cache for ${activeAddress}, fetching new data.`, e);
        localStorage.removeItem(cacheKey);
      }
    }

    if (!cacheUsed || isCacheStale) {
      if (!cacheUsed) {
        setLoading(true);
      }
      setError(null);
      try {
        // 1. Fetch all transactions for the user's account
        let allTransactions: Transaction[] = [];
        let nextToken: string | undefined = undefined;
        const afterTime = new Date("2025-01-01T00:00:00Z").toISOString();

        do {
          let url = `${INDEXER_URL}/v2/accounts/${activeAddress}/transactions?after-time=${afterTime}`;
          if (nextToken) {
            url += `&next=${nextToken}`;
          }
          
          const response = await retryFetch(url);
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Indexer API for transactions responded with ${response.status}: ${errorText}`);
          }

          const data = await response.json();
          allTransactions = allTransactions.concat(data.transactions);
          nextToken = data['next-token'];

        } while (nextToken);

        setTransactions(allTransactions);

        const newCache: CachedAccountData = {
          timestamp: Date.now(),
          transactions: allTransactions,
        };
        localStorage.setItem(cacheKey, JSON.stringify(newCache));

      } catch (err) {
        console.error("Failed to fetch account data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    }
  }, [activeAddress, internalRefetchTrigger]); // fetchData depends on activeAddress and internalRefetchTrigger

  useEffect(() => {
    fetchData();
  }, [activeAddress, internalRefetchTrigger, fetchData]);

  const refetch = useCallback(() => {
    // Clear cache for the active address to force a fresh fetch
    if (activeAddress) {
      localStorage.removeItem(`${ACCOUNT_DATA_CACHE_KEY_PREFIX}${activeAddress}`);
    }
    setInternalRefetchTrigger(prev => prev + 1);
  }, [activeAddress]);

  return { transactions, loading, error, refetch };
}