"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { retryFetch } from '@/utils/api'; // Import retryFetch

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

// Define a minimal interface for the account response needed
interface AccountDataResponse {
  account: {
    'created-at-round': number;
    address: string;
    // We don't need the full transaction list anymore
  };
  'current-round': number;
}

interface CachedAccountCreationData {
  timestamp: number;
  createdAtRound: number;
  currentRound: number;
}

const ACCOUNT_DATA_CACHE_KEY_PREFIX = 'accountCreationDataCache_'; // Prefix to store per-address
const ACCOUNT_DATA_CACHE_DURATION = 15 * 1000; // 15 seconds

// Algorand Genesis Timestamp (MainNet) in seconds
const ALGORAND_GENESIS_TIMESTAMP_SECONDS = 1596240000; 
// Approximate block time in seconds (used for estimation)
const APPROX_BLOCK_TIME_SECONDS = 3.3; 

/**
 * Estimates the creation date based on the created-at-round.
 * This is an approximation as Indexer does not provide the exact timestamp for creation.
 */
const estimateCreationDate = (createdAtRound: number): Date | null => {
    if (createdAtRound <= 0) return null;
    
    // Estimate time elapsed since genesis round (round 1)
    // We assume round 1 is at genesis timestamp.
    const roundsSinceGenesis = createdAtRound - 1;
    const estimatedTimeSinceGenesisSeconds = roundsSinceGenesis * APPROX_BLOCK_TIME_SECONDS;
    
    const estimatedTimestampSeconds = ALGORAND_GENESIS_TIMESTAMP_SECONDS + estimatedTimeSinceGenesisSeconds;
    
    return new Date(estimatedTimestampSeconds * 1000);
};


export function useAccountData(activeAddress: string | undefined) {
  const [createdAtRound, setCreatedAtRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [internalRefetchTrigger, setInternalRefetchTrigger] = useState(0);

  const fetchData = useCallback(async () => {
    if (!activeAddress) {
      setCreatedAtRound(null);
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
        isCacheStale = Date.now() - cachedData.timestamp > ACCOUNT_DATA_CACHE_DURATION;

        setCreatedAtRound(cachedData.createdAtRound);
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
        // 1. Fetch account details using the simpler endpoint
        const url = `${INDEXER_URL}/v2/accounts/${activeAddress}`;
        
        const response = await retryFetch(url, undefined, 5);
        
        if (response.status === 404) {
            // Account not found (not funded yet)
            setCreatedAtRound(0); // Use 0 to indicate not created
            setLoading(false);
            return;
        }
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Indexer API for account details responded with ${response.status}: ${errorText}`);
        }

        const data: AccountDataResponse = await response.json();
        
        // NEW: Log the raw response data
        console.log(`[useAccountData] Raw Indexer response for ${activeAddress}:`, data);
        
        const creationRound = data.account['created-at-round'];
        
        setCreatedAtRound(creationRound);

        const newCache: CachedAccountCreationData = {
          timestamp: Date.now(),
          createdAtRound: creationRound,
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

  // --- Calculate First Transaction Date and Days Elapsed ---
  const firstTransactionDate = useMemo(() => {
    if (createdAtRound === null || createdAtRound <= 0) return null;
    return estimateCreationDate(createdAtRound);
  }, [createdAtRound]);

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