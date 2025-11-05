import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda, createFormStructureInCoda } from './feedback-coda-utils';

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
      
      console.log("[Form Structure API] Received POST request to create new version.");
      
      if (!newJsonString) {
        console.error("[Form Structure API] Error: Missing newJsonString in request body.");
        return response.status(400).json({ error: 'Missing newJsonString for creation.' });
      }
      
      // Log the start and end of the received string to check for truncation
      console.log(`[Form Structure API] Received JSON String Length: ${newJsonString.length}`);
      console.log(`[Form Structure API] Received JSON String Start (100 chars): ${newJsonString.substring(0, 100)}`);
      console.log(`[Form Structure API] Received JSON String End (100 chars): ${newJsonString.substring(newJsonString.length - 100)}`);

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