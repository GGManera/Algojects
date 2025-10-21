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

// Simple in-memory cache for different types of responses
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function fetchAssetHolders(assetId: number, round: number): Promise<Map<string, number>> {
  if (!round) {
    console.error("[Allo API] fetchAssetHolders failed: Round number is missing.");
    throw new Error("Round number must be provided to fetch asset holders.");
  }

  const now = Date.now();
  const cacheKey = `asset-${assetId}-${round}`;
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
    console.log(`[Allo API] Using fresh cache for asset ${assetId} at round ${round}.`);
    return cachedEntry.data;
  }

  try {
    const url = `${ALLO_API_URL}/v1/asset/${assetId}/snapshot/${round}`;
    console.log(`[Allo API] Initiating fetch for asset holders: ${url}`);
    const response = await fetch(url);
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
    console.error(`[Allo API] Error fetching holders for asset ${assetId} at round ${round}:`, error);
    if (cachedEntry) {
      return cachedEntry.data;
    }
    throw error;
  }
}

// --- CORRECTED FUNCTION FOR USER ASSETS ---

export interface UserAsset {
  'asset-id': number;
  amount: number;
  'unit-name'?: string;
}

export interface UserAssetsResponse {
  meta: { name: string; type: string }[];
  data: [number, number, string][];
  rows: number;
}

export async function fetchUserAssets(address: string, round: number): Promise<UserAsset[]> {
    const ALLO_USER_ASSETS_URL = `https://analytics-api.allo.info/v1/address/${address}/assets/${round}`;

    if (!round) {
        console.error("[Allo API] fetchUserAssets failed: Round number is missing.");
        throw new Error("Round number must be provided to fetch user assets.");
    }

    const now = Date.now();
    const cacheKey = `user-${address}-${round}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(`[Allo API] Using fresh cache for user ${address} assets at round ${round}.`);
        return cachedEntry.data;
    }

    try {
        console.log(`[Allo API] Initiating fetch for user assets: ${ALLO_USER_ASSETS_URL}`);
        const response = await fetch(ALLO_USER_ASSETS_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch assets for address ${address}`);
        }
        const result: UserAssetsResponse = await response.json();
        
        const assets: UserAsset[] = (result.data || []).map(item => ({
            'asset-id': item[0],
            amount: item[1],
            'unit-name': item[2]
        }));
        
        cache.set(cacheKey, { data: assets, timestamp: now });
        return assets;
    } catch (error) {
        console.error(`[Allo API] Error fetching assets for address ${address}:`, error);
        if (cachedEntry) {
            return cachedEntry.data;
        }
        throw error;
    }
}