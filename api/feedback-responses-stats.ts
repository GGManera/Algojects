import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callCodaApi } from './feedback-coda-utils'; // Re-use the existing Coda API caller

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [key: string]: string; // The column containing the JSON response
  };
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const CODA_FORM_RESPONSES_TABLE_ID = process.env.VITE_CODA_FORM_RESPONSES_TABLE_ID;
  const CODA_COLUMN_RESPONSE_JSON = process.env.VITE_CODA_FORM_RESPONSES_COLUMN_ID;

  if (!CODA_FORM_RESPONSES_TABLE_ID || !CODA_COLUMN_RESPONSE_JSON) {
    return response.status(500).json({ 
      error: 'Coda Feedback Responses Table ID or Column ID is not configured. Please check environment variables (VITE_CODA_FORM_RESPONSES_TABLE_ID/VITE_CODA_FORM_RESPONSES_COLUMN_ID).' 
    });
  }

  try {
    if (request.method === 'GET') {
      console.log("[Feedback Responses Stats API] Fetching all responses from Coda...");
      const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_RESPONSES_TABLE_ID}/rows`);
      
      const parsedResponses = data.items.map(row => {
        const jsonString = row.values[CODA_COLUMN_RESPONSE_JSON];
        console.log(`[Feedback Responses Stats API] Raw JSON string from Coda for row ${row.id}:`, jsonString); // NEW: Log raw JSON string
        try {
          return JSON.parse(jsonString);
        } catch (e) {
          console.error(`[Feedback Responses Stats API] Failed to parse JSON for row ${row.id}:`, e);
          return null; // Return null for unparseable rows
        }
      }).filter(Boolean); // Filter out nulls

      console.log(`[Feedback Responses Stats API] Fetched ${parsedResponses.length} responses.`);
      return response.status(200).json({ responses: parsedResponses });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("[Feedback Responses Stats API] Error in handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}