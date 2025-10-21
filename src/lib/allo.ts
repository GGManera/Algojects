"use client";

import { Algodv2 } from 'algosdk';

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
const cache = new Map<number, { data: Map<string, number>; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchAssetHolders(assetId: number, algodClient: Algodv2): Promise<Map<string, number>> {
  const now = Date.now();
  const cachedEntry = cache.get(assetId);
  if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
    return cachedEntry.data;
  }

  try {
    const status = await algodClient.status().do();
    const latestRound = status['last-round'];

    const response = await fetch(`${ALLO_API_URL}/v1/asset/${assetId}/snapshot/${latestRound}`);
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
    
    cache.set(assetId, { data: holdingsMap, timestamp: now });

    return holdingsMap;
  } catch (error) {
    console.error(`Error fetching holders for asset ${assetId}:`, error);
    // If fetch fails, try to return stale cache data if available
    if (cachedEntry) {
      return cachedEntry.data;
    }
    throw error;
  }
}