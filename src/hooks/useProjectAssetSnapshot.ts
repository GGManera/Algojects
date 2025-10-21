"use client";

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { retryFetch } from '@/utils/api';

interface AssetHolder {
  address: string;
  amount: number; // In micro-units
}

interface AssetSnapshotData {
  holders: AssetHolder[];
  round: number;
}

const ASSET_SNAPSHOT_CACHE_KEY = 'assetSnapshotCache';
const ASSET_SNAPSHOT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const ALLO_INFO_API_URL = "https://analytics-api.allo.info"; // NEW: Define Allo.info URL

const fetchAssetSnapshot = async (assetId: number, round: number): Promise<AssetSnapshotData> => {
  if (assetId <= 0 || round <= 0) {
    return { holders: [], round };
  }

  // NEW: Use the real Allo.info endpoint
  const url = `${ALLO_INFO_API_URL}/v1/asset/${assetId}/snapshot/${round}`;
  
  const response = await retryFetch(url);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to fetch asset snapshot: ${response.status}`);
  }

  const data = await response.json();
  
  // The API returns a list of holders
  const holders: AssetHolder[] = data.holders || [];

  return { holders, round };
};

export function useProjectAssetSnapshot(assetId: number | undefined, round: number | undefined) {
  const [assetHoldingsMap, setAssetHoldingsMap] = useState<Map<string, number>>(new Map());

  const queryKey = ['assetSnapshot', assetId, round];

  const { data, isLoading, isFetching, error, refetch } = useQuery<AssetSnapshotData, Error>({
    queryKey,
    queryFn: () => fetchAssetSnapshot(assetId!, round!),
    enabled: !!assetId && assetId > 0 && !!round && round > 0,
    staleTime: ASSET_SNAPSHOT_CACHE_DURATION,
    gcTime: ASSET_SNAPSHOT_CACHE_DURATION * 2,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.holders) {
      const newMap = new Map<string, number>();
      data.holders.forEach(holder => {
        newMap.set(holder.address, holder.amount);
      });
      setAssetHoldingsMap(newMap);
    } else if (!isLoading && !isFetching) {
      setAssetHoldingsMap(new Map());
    }
  }, [data, isLoading, isFetching]);

  return { 
    assetHoldingsMap, 
    loading: isLoading || isFetching, 
    error: error ? error.message : null, 
    refetch 
  };
}