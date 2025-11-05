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
      const { jsonString, rowId } = await fetchFormStructureFromCoda();
      console.log("[Form Structure Handler] Successfully fetched form structure.");
      return response.status(200).json({ ...JSON.parse(jsonString), rowId });
    } else if (request.method === 'POST') {
      console.log("[Form Structure Handler] Handling POST request.");
      let newJsonString: string;
      
      if (typeof request.body === 'string') {
        newJsonString = request.body;
      } else if (typeof request.body === 'object' && request.body !== null) {
        newJsonString = JSON.stringify(request.body);
      } else {
        console.error("[Form Structure Handler] Error: Invalid or missing request body.");
        return response.status(400).json({ error: 'Invalid or missing JSON string in request body.' });
      }
      
      console.log("[Form Structure Handler] Received POST request to create new version.");
      
      if (!newJsonString) {
        console.error("[Form Structure Handler] Error: newJsonString is empty after processing.");
        return response.status(400).json({ error: 'Missing newJsonString for creation.' });
      }
      
      console.log(`[Form Structure Handler] Received JSON String Length: ${newJsonString.length}`);
      console.log(`[Form Structure Handler] Received JSON String Start (100 chars): ${newJsonString.substring(0, Math.min(newJsonString.length, 100))}`);
      console.log(`[Form Structure Handler] Received JSON String End (100 chars): ${newJsonString.substring(Math.max(0, newJsonString.length - 100))}`);
      console.log(`[Form Structure Handler] Full received JSON string: ${newJsonString}`);

      await createFormStructureInCoda(newJsonString);
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