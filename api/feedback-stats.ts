import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormResponsesFromCoda } from './feedback-coda-utils';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    if (request.method === 'GET') {
      const responsesData = await fetchFormResponsesFromCoda();
      return response.status(200).json({ responses: responsesData });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in feedback-stats handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}