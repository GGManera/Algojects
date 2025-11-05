import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda, createFormStructureInCoda } from './feedback-coda-utils'; // UPDATED: Import createFormStructureInCoda

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    if (request.method === 'GET') {
      // 1. GET /api/form-structure: Fetch the current LATEST schema
      const { jsonString, rowId } = await fetchFormStructureFromCoda();
      // Include rowId in the response so the client can use it for context/audit
      return response.status(200).json({ ...JSON.parse(jsonString), rowId });
    } else if (request.method === 'POST') { // CHANGED from PUT to POST for versioning
      // 2. POST /api/form-structure: Create a new schema version
      const { newJsonString } = request.body; // rowId is no longer needed for POST
      if (!newJsonString) {
        return response.status(400).json({ error: 'Missing newJsonString for creation.' });
      }
      await createFormStructureInCoda(newJsonString); // Use the new creation function
      return response.status(200).json({ message: 'New form structure version created successfully.' });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in form-structure handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}