import type { VercelRequest, VercelResponse } from '@vercel/node';
import { callCodaApi } from './feedback-coda-utils.js'; // Adicionado .js

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
  const CODA_FORM_RESPONSES_TABLE_ID = process.env.CODA_FORM_RESPONSES_TABLE_ID;
  const CODA_COLUMN_RESPONSE_JSON_EN = process.env.CODA_FORM_RESPONSES_COLUMN_ID;
  const CODA_COLUMN_RESPONSE_JSON_PT = process.env.CODA_FORM_RESPONSES_PT_COLUMN_ID;

  if (!CODA_FORM_RESPONSES_TABLE_ID || !CODA_COLUMN_RESPONSE_JSON_EN || !CODA_COLUMN_RESPONSE_JSON_PT) {
    return response.status(500).json({ 
      error: 'Coda Feedback Responses Table ID or Column IDs are not configured.'
    });
  }

  try {
    if (request.method === 'GET') {
      console.log("[Feedback Responses Stats API] Fetching all responses from Coda...");
      const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_RESPONSES_TABLE_ID}/rows`);
      
      const parsedResponses = data.items.flatMap(row => {
        const responses: any[] = [];
        
        // 1. Try parsing English response
        const enJsonString = row.values[CODA_COLUMN_RESPONSE_JSON_EN];
        if (enJsonString) {
          try {
            responses.push(JSON.parse(enJsonString));
          } catch (e) {
            console.error(`[Feedback Responses Stats API] Failed to parse EN JSON for row ${row.id}:`, e);
          }
        }
        
        // 2. Try parsing Portuguese response
        const ptJsonString = row.values[CODA_COLUMN_RESPONSE_JSON_PT];
        if (ptJsonString) {
          try {
            responses.push(JSON.parse(ptJsonString));
          } catch (e) {
            console.error(`[Feedback Responses Stats API] Failed to parse PT JSON for row ${row.id}:`, e);
          }
        }

        return responses;
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