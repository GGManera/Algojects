"use client";

const ALLO_API_URL = "https://analytics-api.allo.info";
const PROXY_ENDPOINT = "/api/allo-proxy"; // New proxy endpoint

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
    const targetUrl = `${ALLO_API_URL}/v1/asset/${assetId}/snapshot/${round}`;
    const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;
    
    console.log(`[Allo API] Initiating PROXY fetch for asset holders: ${targetUrl}`);
    
    const response = await fetch(proxyUrl);
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error("Allo API Proxy Error:", errorData);
      throw new Error(errorData.error || `Failed to fetch asset holders via proxy: ${response.status}`);
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

// --- NEW CORRECTED FUNCTION FOR USER ASSET BALANCE ---

export interface UserAssetBalanceResponse {
  meta: { name: string; type: string }[];
  data: [number, number, string][]; // [asset-id, amount, unit-name]
  rows: number;
}

/**
 * Fetches the balance of a specific asset for a user at a given round.
 * Returns the amount held (in display units) or 0 if not found/error.
 */
export async function fetchUserAssetBalance(address: string, assetId: number, round: number): Promise<{ amount: number; unitName: string }> {
    if (!round || !assetId) {
        console.error("[Allo API] fetchUserAssetBalance failed: Missing round or assetId.");
        return { amount: 0, unitName: '' };
    }

    const now = Date.now();
    const cacheKey = `user-asset-${address}-${assetId}-${round}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(`[Allo API] Using fresh cache for user ${address} asset ${assetId} at round ${round}.`);
        return cachedEntry.data;
    }

    try {
        // Use the correct endpoint: /v1/address/{address}/assetround/{asset}/{round}
        const targetUrl = `${ALLO_API_URL}/v1/address/${address}/assetround/${assetId}/${round}`;
        const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;

        console.log(`[Allo API] Initiating PROXY fetch for user asset balance: ${targetUrl}`);
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            // If the response is 404 or 500, it often means the user doesn't hold the asset at that round.
            // We should try to parse the error, but default to 0 balance if fetch fails.
            const errorData = await response.json();
            console.error("Allo API Proxy Error:", errorData);
            // Throwing here will be caught below, resulting in 0 balance.
            throw new Error(errorData.error || `Failed to fetch asset balance via proxy: ${response.status}`);
        }
        
        const result: UserAssetBalanceResponse = await response.json();
        
        // The data array should contain one entry: [asset-id, amount, unit-name]
        if (result.data && result.data.length > 0) {
            const [fetchedAssetId, amount, unitName] = result.data[0];
            
            const finalResult = { amount: amount || 0, unitName: unitName || '' };
            cache.set(cacheKey, { data: finalResult, timestamp: now });
            return finalResult;
        }
        
        // If data is empty, balance is 0
        const finalResult = { amount: 0, unitName: '' };
        cache.set(cacheKey, { data: finalResult, timestamp: now });
        return finalResult;

    } catch (error) {
        console.error(`[Allo API] Error fetching asset balance for address ${address} asset ${assetId}:`, error);
        // If an error occurred, check cache or return 0
        if (cachedEntry) {
            return cachedEntry.data;
        }
        return { amount: 0, unitName: '' };
    }
}