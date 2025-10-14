import type { VercelRequest, VercelResponse } from '../../../vercel'; // Updated import path

const INDEXER_URL = `https://mainnet-idx.algonode.cloud`;

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const { assetId, round } = request.query;

  if (!assetId || typeof assetId !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid asset ID.' });
  }
  if (!round || typeof round !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid round number.' });
  }

  const assetIndex = parseInt(assetId, 10);
  const targetRound = parseInt(round, 10);

  if (isNaN(assetIndex) || assetIndex <= 0) {
    return response.status(400).json({ error: 'Asset ID must be a positive integer.' });
  }
  if (isNaN(targetRound) || targetRound <= 0) {
    return response.status(400).json({ error: 'Round number must be a positive integer.' });
  }

  const apiKey = process.env.BLOCKDAEMON_API_KEY;

  if (!apiKey || apiKey === 'SUA_CHAVE_AQUI') {
    const errorMessage = 'API key is not configured. Please ensure BLOCKDAEMON_API_KEY is set correctly in Vercel environment variables.';
    console.error(`[Vercel API] ${errorMessage}`);
    return response.status(500).json({ error: errorMessage });
  }

  try {
    // Fetch asset details
    const assetResponse = await fetch(`${INDEXER_URL}/v2/assets/${assetIndex}`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (assetResponse.status === 404) {
      return response.status(404).json({ error: `Asset with ID ${assetIndex} not found.` });
    }
    if (!assetResponse.ok) {
      const errorText = await assetResponse.text();
      throw new Error(`Indexer API for asset details responded with ${assetResponse.status}: ${errorText}`);
    }

    const assetData = await assetResponse.json();
    const assetCreationRound = assetData.asset.params['created-at-round'];

    if (targetRound < assetCreationRound) {
      return response.status(404).json({ error: `Asset with ID ${assetIndex} did not exist at round ${targetRound}. It was created at round ${assetCreationRound}.` });
    }

    // If the asset exists and was created by or before the target round, return its current details.
    // Note: Indexer does not provide historical asset parameters directly.
    // This response will contain the *current* parameters if the asset existed at the target round.
    return response.status(200).json({
      asset: assetData.asset,
      snapshotRound: targetRound,
      note: "Indexer API provides current asset parameters. This snapshot confirms existence at the round, but parameters are current.",
    });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during asset snapshot fetch.';
    console.error(`[Vercel API] Error in getAssetSnapshot try-catch: ${errorMessage}`, err);
    return response.status(500).json({ error: errorMessage });
  }
}