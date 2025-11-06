import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda, createFormStructureInCoda } from './feedback-coda-utils.js'; // Adicionado .js

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  console.log(`[Form Structure Handler] Incoming ${request.method} request to ${request.url}`);
  try {
    if (request.method === 'GET') {
      console.log("[Form Structure Handler] Handling GET request.");
      const { enJsonString, ptJsonString, rowId } = await fetchFormStructureFromCoda();
      console.log("[Form Structure Handler] Successfully fetched form structure.");
      
      const enSchema = JSON.parse(enJsonString);
      const ptSchema = JSON.parse(ptJsonString);

      // Return both schemas and the rowId
      return response.status(200).json({ 
        schema: {
          en: { ...enSchema, rowId },
          pt: { ...ptSchema, rowId },
        }
      });
    } else if (request.method === 'POST') {
      console.log("[Form Structure Handler] Handling POST request.");
      
      const newJsonStrings = request.body;
      
      if (!newJsonStrings || typeof newJsonStrings !== 'object' || !newJsonStrings.en || !newJsonStrings.pt) {
        console.error("[Form Structure Handler] Error: Invalid or missing JSON strings in request body.");
        return response.status(400).json({ error: 'Missing English (en) or Portuguese (pt) JSON strings in request body.' });
      }
      
      console.log(`[Form Structure Handler] Received POST request to create new version. EN Length: ${newJsonStrings.en.length}, PT Length: ${newJsonStrings.pt.length}`);

      await createFormStructureInCoda(newJsonStrings);
      console.log("[Form Structure Handler] New form structure version created successfully.");
      return response.status(200).json({ message: 'New form structure version created successfully.' });
    } else {
      console.log(`[Form Structure Handler] Method Not Allowed: ${request.method}`);
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("[Form Structure Handler] Error in handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}