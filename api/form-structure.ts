import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda, updateFormStructureInCoda } from './feedback-coda-utils';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    if (request.method === 'GET') {
      // 1. GET /api/form-structure: Fetch the current schema
      const { jsonString, rowId } = await fetchFormStructureFromCoda();
      // Include rowId in the response so the client can use it for updates
      return response.status(200).json({ ...JSON.parse(jsonString), rowId });
    } else if (request.method === 'PUT') {
      // 2. PUT /api/form-structure: Update the schema (now callable directly by client)
      const { newJsonString, rowId } = request.body;
      if (!newJsonString || !rowId) {
        return response.status(400).json({ error: 'Missing newJsonString or rowId for update.' });
      }
      await updateFormStructureInCoda(newJsonString, rowId);
      return response.status(200).json({ message: 'Form structure updated successfully.' });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in form-structure handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}