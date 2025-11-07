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

// --- NEW FUNCTION FOR INDIVIDUAL ASSET BALANCE ---

export interface AssetBalanceResponse {
  meta: { name: string; type: string }[];
  data: [number, number, string][]; // [asset-id, amount, unit-name]
  rows: number;
}

/**
 * Fetches the balance of a specific asset for an address at a given round.
 * Returns the amount held (in display units) or 0 if not found/held.
 */
export async function fetchAssetBalanceAtRound(address: string, assetId: number, round: number): Promise<{ amount: number; unitName: string }> {
    if (!round || !address || !assetId) {
        console.error("[Allo API] fetchAssetBalanceAtRound failed: Missing parameters.");
        return { amount: 0, unitName: '' };
    }

    const now = Date.now();
    const cacheKey = `balance-${address}-${assetId}-${round}`;
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_DURATION) {
        console.log(`[Allo API] Using fresh cache for balance of asset ${assetId} for user ${address} at round ${round}.`);
        return cachedEntry.data;
    }

    try {
        const targetUrl = `${ALLO_API_URL}/v1/address/${address}/assetround/${assetId}/${round}`;
        const proxyUrl = `${PROXY_ENDPOINT}?url=${encodeURIComponent(targetUrl)}`;

        console.log(`[Allo API] Initiating PROXY fetch for asset balance: ${targetUrl}`);
        
        const response = await fetch(proxyUrl);
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error("Allo API Proxy Error:", errorData);
            throw new Error(errorData.error || `Failed to fetch asset balance via proxy: ${response.status}`);
        }
        
        const result: AssetBalanceResponse = await response.json();
        
        // The response data array should contain one entry: [asset-id, amount, unit-name]
        const assetData = result.data?.[0];
        
        let amount = 0;
        let unitName = '';

        if (assetData && assetData[0] === assetId) {
            amount = assetData[1];
            unitName = assetData[2] || '';
        }
        
        const finalResult = { amount, unitName };
        cache.set(cacheKey, { data: finalResult, timestamp: now });
        return finalResult;
    } catch (error) {
        console.error(`[Allo API] Error fetching balance for asset ${assetId} for address ${address}:`, error);
        if (cachedEntry) {
            return cachedEntry.data;
        }
        return { amount: 0, unitName: '' };
    }
}