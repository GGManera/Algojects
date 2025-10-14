import type { VercelRequest, VercelResponse } from './vercel'; // Updated import path

const CREATOR_ADDRESS = "PTPAK7NH3KA3D23WBR5GWVS57SO3FCJFBGK2IPDQQFFEXDHO4ENVH65PPM";
const INDEXER_URL = `https://mainnet-idx.algonode.cloud/v2/accounts/${CREATOR_ADDRESS}/created-assets`;

/**
 * Core logic to fetch created assets. This can be used by any environment.
 * Returns either the data or an object with an 'error' property.
 */
export async function fetchCreatedAssets(): Promise<any> {
  const apiKey = process.env.BLOCKDAEMON_API_KEY;

  console.log(`[Vercel API] BLOCKDAEMON_API_KEY present: ${!!apiKey && apiKey !== 'SUA_CHAVE_AQUI'}`);

  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
    const errorMessage = 'API key is not configured. Please ensure BLOCKDAEMON_API_KEY is set correctly in Vercel environment variables.';
    console.error(`[Vercel API] ${errorMessage}`);
    return { error: errorMessage, assets: [] }; // Ensure assets is an empty array on error
  }

  try {
    const fetchResponse = await fetch(INDEXER_URL, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      const errorMessage = `Indexer API responded with status ${fetchResponse.status}: ${errorText}`;
      console.error(`[Vercel API] ${errorMessage}`);
      return { error: errorMessage, assets: [] }; // Ensure assets is an empty array on error
    }

    const data = await fetchResponse.json();
    console.log('[Vercel API] Successfully fetched data from Indexer.');

    // Filter assets where unit-name is 'HERO'
    const filteredAssets = (data.assets || []).filter( // Ensure data.assets is an array
      (asset: { params: { 'unit-name': string } }) => asset.params['unit-name'] === 'HERO'
    );

    return { ...data, assets: filteredAssets };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during fetchCreatedAssets.';
    console.error(`[Vercel API] Error in fetchCreatedAssets try-catch: ${errorMessage}`, err);
    return { error: errorMessage, assets: [] }; // Ensure assets is an empty array on error
  }
}

/**
 * Vercel serverless function handler. This is used in production.
 */
export default async function handler(
  _request: VercelRequest,
  response: VercelResponse,
) {
  const result = await fetchCreatedAssets();

  if (result.error) {
    return response.status(500).json({ error: result.error, assets: result.assets }); // Pass assets even on error
  } else {
    return response.status(200).json(result);
  }
}