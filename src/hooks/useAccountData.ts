block) para obter o timestamp exato da criação da conta, garantindo precisão.">
"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { retryFetch } from '@/utils/api'; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

// Define interfaces para as respostas necessárias
interface AccountDataResponse {
  account: {
    'created-at-round': number;
    address: string;
  };
  'current-round': number;
}

interface BlockDataResponse {
  'current-round': number;
  'timestamp': number; // Timestamp em segundos
}

interface CachedAccountCreationData {
  timestampMs: number; // Timestamp exato da criação (em milissegundos)
  currentRound: number;
}

const ACCOUNT_DATA_CACHE_KEY_PREFIX = 'accountCreationDataCache_'; // Prefix to store per-address
const ACCOUNT_DATA_CACHE_DURATION = 15 * 1000; // 15 seconds

export function useAccountData(activeAddress: string | undefined) {
  // Armazenamos o timestamp exato da criação em milissegundos
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
        // --- 1. Fetch Account Details to get created-at-round ---
        const accountUrl = `${INDEXER_URL}/v2/accounts/${activeAddress}`;
        const accountResponse = await retryFetch(accountUrl, undefined, 5);
        
        if (accountResponse.status === 404) {
            setFirstTransactionTimestampMs(0); // Account not funded/created
            setLoading(false);
            return;
        }
        
        if (!accountResponse.ok) {
          const errorText = await accountResponse.text();
          throw new Error(`Indexer API for account details responded with ${accountResponse.status}: ${errorText}`);
        }

        const accountData: AccountDataResponse = await accountResponse.json();
        const creationRound = accountData.account['created-at-round'];
        
        if (creationRound === 0) {
            setFirstTransactionTimestampMs(0); // Account exists but has no creation round (e.g., genesis account)
            setLoading(false);
            return;
        }

        // --- 2. Fetch Block Timestamp using created-at-round ---
        const blockUrl = `${INDEXER_URL}/v2/blocks/${creationRound}`;
        const blockResponse = await retryFetch(blockUrl, undefined, 5);
        
        if (!blockResponse.ok) {
            const errorText = await blockResponse.text();
            throw new Error(`Indexer API for block ${creationRound} responded with ${blockResponse.status}: ${errorText}`);
        }
        
        const blockData: BlockDataResponse = await blockResponse.json();
        
        // Timestamp is in seconds, convert to milliseconds
        const exactTimestampMs = blockData.timestamp * 1000;
        
        setFirstTransactionTimestampMs(exactTimestampMs);

        const newCache: CachedAccountCreationData = {
          timestampMs: exactTimestampMs, 
          currentRound: accountData['current-round'],
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