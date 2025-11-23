"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { retryFetch } from '@/utils/api'; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

// Define a interface para a resposta de transações
interface TransactionDataResponse {
  transactions: Array<{
    'round-time': number; // Timestamp em segundos
    id: string;
    // Outros campos de transação
  }>;
  'current-round': number;
}

interface CachedAccountCreationData {
  timestampMs: number; // Timestamp exato da primeira transação (em milissegundos)
  currentRound: number;
}

const ACCOUNT_DATA_CACHE_KEY_PREFIX = 'accountCreationDataCache_'; // Prefix to store per-address
const ACCOUNT_DATA_CACHE_DURATION = 15 * 1000; // 15 seconds

export function useAccountData(activeAddress: string | undefined) {
  // Armazenamos o timestamp exato da primeira transação em milissegundos
  const [firstTransactionTimestampMs, setFirstTransactionTimestampMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalRefetchTrigger, setInternalRefetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    if (!activeAddress) {
      setFirstTransactionTimestampMs(null);
      setLoading(false);
      return;
    }

    const cacheKey = `${ACCOUNT_DATA_CACHE_KEY_PREFIX}${activeAddress}`;
    let cacheUsed = false;
    let isCacheStale = true;

    const cachedItem = localStorage.getItem(cacheKey);
    if (cachedItem) {
      try {
        const cachedData: CachedAccountCreationData = JSON.parse(cachedItem);
        
        // Check cache freshness based on stored timestamp
        isCacheStale = Date.now() - cachedData.timestampMs > ACCOUNT_DATA_CACHE_DURATION;
        
        setFirstTransactionTimestampMs(cachedData.timestampMs);
        cacheUsed = true;
        setLoading(false);
        
        if (!isCacheStale) {
          return;
        }
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
        // --- 1. Fetch the first transaction using limit=1 and order=asc (chronological order) ---
        const url = `${INDEXER_URL}/v2/accounts/${activeAddress}/transactions?limit=1&order=asc`;
        
        const response = await retryFetch(url, undefined, 5);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Indexer API for account transactions responded with ${response.status}: ${errorText}`);
        }

        const data: TransactionDataResponse = await response.json();
        
        const firstTx = data.transactions?.[0];
        let exactTimestampMs: number | null = null;

        if (firstTx) {
            // round-time is in seconds, convert to milliseconds
            exactTimestampMs = firstTx['round-time'] * 1000;
        } else {
            // If no transactions found (e.g., account exists but has no TXs, or is unfunded)
            exactTimestampMs = 0; 
        }
        
        setFirstTransactionTimestampMs(exactTimestampMs);

        const newCache: CachedAccountCreationData = {
          timestampMs: exactTimestampMs || 0, 
          currentRound: data['current-round'],
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(newCache));

      } catch (err) {
        console.error("Failed to fetch account creation data:", err);
        setError(err instanceof Error ? err.message : "An unknown error occurred.");
      } finally {
        setLoading(false);
      }
    }
  }, [activeAddress, internalRefetchTrigger]);

  useEffect(() => {
    fetchData();
  }, [activeAddress, internalRefetchTrigger, fetchData]);

  const refetch = useCallback(() => {
    if (activeAddress) {
      localStorage.removeItem(`${ACCOUNT_DATA_CACHE_KEY_PREFIX}${activeAddress}`);
    }
    setInternalRefetchTrigger(prev => prev + 1);
  }, [activeAddress]);

  // --- Calculate First Transaction Date and Days Elapsed using exact timestamp ---
  const firstTransactionDate = useMemo(() => {
    if (firstTransactionTimestampMs === null || firstTransactionTimestampMs <= 0) return null;
    return new Date(firstTransactionTimestampMs);
  }, [firstTransactionTimestampMs]);

  const daysSinceFirstTransaction = useMemo(() => {
    if (!firstTransactionDate) return 0;
    return Math.floor((Date.now() - firstTransactionDate.getTime()) / (1000 * 60 * 60 * 24));
  }, [firstTransactionDate]);
  // --- END NEW ---

  return { 
    loading, 
    error, 
    refetch,
    firstTransactionDate,
    daysSinceFirstTransaction,
  };
}