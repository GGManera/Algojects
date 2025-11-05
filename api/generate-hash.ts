import type { VercelRequest, VercelResponse } from '@vercel/node';
import { sha256 } from 'js-sha256';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    if (request.method === 'POST') {
      const jsonDraft = request.body;
      if (!jsonDraft) {
        return response.status(400).json({ error: 'Missing JSON draft in request body.' });
      }
      
      // Normalize JSON stringification before hashing
      const normalizedJsonString = JSON.stringify(jsonDraft, Object.keys(jsonDraft).sort(), 2);
      
      const hash = sha256(normalizedJsonString);
      
      return response.status(200).json({ hash, normalizedJsonString });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in generate-hash handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}