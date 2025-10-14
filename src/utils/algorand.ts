const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

interface AssetHolding {
  amount: number;
  'asset-id': number;
  'is-frozen': boolean;
}

/**
 * Fetches the holdings of specific asset IDs for a given Algorand address.
 * Returns a Map where keys are asset IDs and values are the amounts held.
 */
export async function fetchAccountAssetHoldings(address: string, assetIds: number[]): Promise<Map<number, number>> {
  const holdingsMap = new Map<number, number>();
  if (!address || assetIds.length === 0) {
    return holdingsMap;
  }

  try {
    // Fetch all asset holdings for the address
    const response = await fetch(`${INDEXER_URL}/v2/accounts/${address}/assets`);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Indexer API for account assets responded with ${response.status}: ${errorText}`);
    }
    const data = await response.json();
    const allHoldings: AssetHolding[] = data.assets || [];

    // Filter and map to the requested asset IDs
    const targetAssetIds = new Set(assetIds);
    allHoldings.forEach(holding => {
      if (targetAssetIds.has(holding['asset-id'])) {
        holdingsMap.set(holding['asset-id'], holding.amount);
      }
    });

  } catch (error) {
    console.error(`Failed to fetch asset holdings for ${address}:`, error);
    // Return empty map on error, or re-throw if critical
  }
  return holdingsMap;
}