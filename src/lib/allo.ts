"use client";

const ALLO_API_URL = "https://analytics-api.allo.info";

export interface AssetHoldersResponse {
  meta: { name: string; type: string }[];
  data: [string | null, number, string][]; // address can be null
  rows: number;
  statistics: {
    elapsed: number;
    rows_read: number;
    bytes_read: number;
  };
}

// Simple in-memory cache
const cache = new Map<string, { data: Map<string, number>; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchAssetHolders(assetId: number, round: number): Promise<Map<string, number>> {
  if (!round) {
    throw new Error("Round number must be provided to fetch asset holders.");
  }

  const now = Date.now();
  const cacheKey = `${assetId}-${round}`;
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
    return cachedEntry.data;
  }

  try {
    const response = await fetch(`${ALLO_API_URL}/v1/asset/${assetId}/snapshot/${round}`);
    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Allo API Error:", errorBody);
      throw new Error(`Failed to fetch asset holders: ${response.statusText}`);
    }
    const result: AssetHoldersResponse = await response.json();

    const holdingsMap = new Map<string, number>();
    if (result.data) {
      for (const [address, balance] of result.data) {
        if (address) {
          holdingsMap.set(address, balance);
        }
      }
    }
    
    cache.set(cacheKey, { data: holdingsMap, timestamp: now });

    return holdingsMap;
  } catch (error) {
    console.error(`Error fetching holders for asset ${assetId} at round ${round}:`, error);
    // If fetch fails, try to return stale cache data if available
    if (cachedEntry) {
      return cachedEntry.data;
    }
    throw error;
  }
}