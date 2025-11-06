import { VercelRequest, VercelResponse } from '@vercel/node';
import { FALLBACK_FORM_STRUCTURE_EN, FALLBACK_FORM_STRUCTURE_PT } from './feedback-fallback-schema.js'; // NEW: Import bilingual fallbacks

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [key: string]: string; // Use index signature since the key is dynamic
  };
}

/**
 * Generic Coda API caller for the feedback system.
 */
export async function callCodaApi<T>(method: string, path: string, body?: any): Promise<T> {
  console.log(`[Coda API] Attempting call to Coda: ${method} ${path}`);
  const CODA_API_KEY = process.env.CODA_FEEDBACK_API_KEY;
  const CODA_DOC_ID = process.env.CODA_FEEDBACK_DOC_ID;

  console.log(`[Coda API] CODA_FEEDBACK_API_KEY present: ${!!CODA_API_KEY && CODA_API_KEY !== 'SUA_CHAVE_API_CODA_AQUI'}`);
  console.log(`[Coda API] CODA_FEEDBACK_DOC_ID: ${CODA_DOC_ID}`);

  if (!CODA_API_KEY || !CODA_DOC_ID) {
    console.error('[Coda API] Missing Coda Feedback API keys or IDs.');
    throw new Error('Coda Feedback API keys or IDs are not configured. Please check environment variables (CODA_FEEDBACK_API_KEY/CODA_FEEDBACK_DOC_ID).');
  }

  const url = `https://coda.io/apis/v1/docs/${CODA_DOC_ID}${path}`;
  const headers = {
    'Authorization': `Bearer ${CODA_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const stringifiedBody = body ? JSON.stringify(body) : undefined;

  console.log(`[Coda API] Request URL: ${url}`);
  console.log(`[Coda API] Request Method: ${method}`);
  if (stringifiedBody) {
    console.log(`[Coda API] Request Body (first 200 chars): ${stringifiedBody.substring(0, Math.min(stringifiedBody.length, 200))}`);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: stringifiedBody,
  });

  console.log(`[Coda API] Response Status: ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Coda API Error (${method} ${path}): ${response.status} - ${errorText}`);
    throw new Error(`Coda API responded with status ${response.status}: ${errorText}`);
  }

  console.log(`[Coda API] Call to ${path} successful.`);
  return response.json() as Promise<T>;
}

/**
 * Fetches the current Form Structure JSONs from Coda.
 * Returns the JSON strings and the Coda Row ID of the LATEST version.
 */
export async function fetchFormStructureFromCoda(): Promise<{ 
    enJsonString: string; 
    ptJsonString: string; 
    rowId: string 
}> {
  console.log('[Coda Feedback] Starting fetchFormStructureFromCoda.');
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.CODA_FORM_STRUCTURE_TABLE_ID;
  const CODA_FORM_STRUCTURE_COLUMN_ID = process.env.CODA_FORM_STRUCTURE_COLUMN_ID || ''; // English
  const CODA_FORM_STRUCTURE_PT_COLUMN_ID = process.env.CODA_FORM_STRUCTURE_PT_COLUMN_ID || ''; // Portuguese

  console.log(`[Coda Feedback] CODA_FORM_STRUCTURE_TABLE_ID: ${CODA_FORM_STRUCTURE_TABLE_ID}`);
  console.log(`[Coda Feedback] CODA_FORM_STRUCTURE_COLUMN_ID (EN): ${CODA_FORM_STRUCTURE_COLUMN_ID}`);
  console.log(`[Coda Feedback] CODA_FORM_STRUCTURE_PT_COLUMN_ID (PT): ${CODA_FORM_STRUCTURE_PT_COLUMN_ID}`);

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !CODA_FORM_STRUCTURE_COLUMN_ID || !CODA_FORM_STRUCTURE_PT_COLUMN_ID) {
    console.error('[Coda Feedback] Missing CODA_FORM_STRUCTURE_TABLE_ID or column IDs.');
    throw new Error('Coda Form Structure IDs are not configured.');
  }

  const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`);
  console.log(`[Coda Feedback] Fetched ${data.items?.length || 0} rows from form structure table.`);

  if (!data.items || data.items.length === 0) {
    console.warn("[Coda Feedback] Form Structure table is empty. Returning fallback structure.");
    return { 
        enJsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE_EN), 
        ptJsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE_PT), 
        rowId: 'fallback' 
    };
  }

  let latestVersion = -1;
  let latestRow: CodaRow | null = null;
  let latestEnJsonString: string | null = null;
  let latestPtJsonString: string | null = null;

  for (const row of data.items) {
    const enJsonString = row.values[CODA_FORM_STRUCTURE_COLUMN_ID];
    
    if (enJsonString) {
      try {
        const parsed = JSON.parse(enJsonString);
        const version = parseFloat(parsed.version);
        if (!isNaN(version) && version > latestVersion) {
          latestVersion = version;
          latestRow = row;
          latestEnJsonString = enJsonString;
          // Get the Portuguese version from the same row
          latestPtJsonString = row.values[CODA_FORM_STRUCTURE_PT_COLUMN_ID] || latestEnJsonString; // Fallback to EN if PT is empty
        }
      } catch (e) {
        console.warn(`[Coda Feedback] Failed to parse EN JSON in row ${row.id}. Skipping.`);
      }
    }
  }

  if (latestRow && latestEnJsonString && latestPtJsonString) {
    console.log(`[Coda Feedback] Found latest version ${latestVersion} for row ${latestRow.id}.`);
    return { enJsonString: latestEnJsonString, ptJsonString: latestPtJsonString, rowId: latestRow.id };
  }

  console.warn("[Coda Feedback] No valid JSON found in Form Structure table. Returning fallback structure.");
  return { 
    enJsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE_EN), 
    ptJsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE_PT), 
    rowId: 'fallback' 
  };
}

/**
 * Creates a new Form Structure JSON row in Coda (POST).
 * Expects an object containing both 'en' and 'pt' JSON strings.
 */
export async function createFormStructureInCoda(newJsonStrings: { en: string, pt: string }): Promise<void> {
  console.log('[Coda Feedback] Starting createFormStructureInCoda.');
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.CODA_FORM_STRUCTURE_TABLE_ID;
  const enColumnId = process.env.CODA_FORM_STRUCTURE_COLUMN_ID;
  const ptColumnId = process.env.CODA_FORM_STRUCTURE_PT_COLUMN_ID;

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !enColumnId || !ptColumnId) {
    console.error('[Coda Feedback] Missing CODA_FORM_STRUCTURE_TABLE_ID or column IDs for creation.');
    throw new Error('Coda Form Structure IDs are not configured.');
  }

  const cells = [
    { column: enColumnId, value: newJsonStrings.en },
    { column: ptColumnId, value: newJsonStrings.pt },
  ];

  const postBody = {
    rows: [
      { cells },
    ],
  };

  console.log("[Coda Feedback] Sending to Coda API with postBody (excluding full JSON):", JSON.stringify({ rows: [{ cells: cells.map(c => ({ column: c.column, value: c.value.substring(0, 50) + '...' })) }] }, null, 2));

  await callCodaApi('POST', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`, postBody);
  console.log('[Coda Feedback] Successfully created new form structure row in Coda.');
}

/**
 * Writes a new user response to the Form Responses table.
 */
export async function writeFormResponseToCoda(responseJson: any, language: 'en' | 'pt'): Promise<void> {
  console.log(`[Coda Feedback] Starting writeFormResponseToCoda for language: ${language}.`);
  const CODA_FORM_RESPONSES_TABLE_ID = process.env.CODA_FORM_RESPONSES_TABLE_ID;
  const CODA_COLUMN_RESPONSE_JSON_EN = process.env.CODA_FORM_RESPONSES_COLUMN_ID;
  const CODA_COLUMN_RESPONSE_JSON_PT = process.env.CODA_FORM_RESPONSES_PT_COLUMN_ID;
  const CODA_COLUMN_LANGUAGE = process.env.CODA_FORM_RESPONSES_LANGUAGE_COLUMN_ID;

  if (!CODA_FORM_RESPONSES_TABLE_ID || !CODA_COLUMN_RESPONSE_JSON_EN || !CODA_COLUMN_RESPONSE_JSON_PT || !CODA_COLUMN_LANGUAGE) {
    console.error('[Coda Feedback] Missing CODA_FORM_RESPONSES_TABLE_ID or column IDs for writing response.');
    throw new Error('Coda Form Responses IDs are not configured. Please check .env.local.');
  }

  const responseJsonString = JSON.stringify(responseJson);
  
  const cells = [
    // Set the JSON string in the correct column based on language
    { column: language === 'en' ? CODA_COLUMN_RESPONSE_JSON_EN : CODA_COLUMN_RESPONSE_JSON_PT, value: responseJsonString },
    // Set the language in the dedicated column
    { column: CODA_COLUMN_LANGUAGE, value: language === 'en' ? 'English' : 'Português-BR' },
  ];

  const postBody = {
    rows: [
      { cells },
    ],
  };

  console.log("[Coda Feedback] Sending response to Coda API with postBody (excluding full JSON):", JSON.stringify({ rows: [{ cells: cells.map(c => ({ column: c.column, value: c.value.substring(0, 50) + '...' })) }] }, null, 2));

  await callCodaApi('POST', `/tables/${CODA_FORM_RESPONSES_TABLE_ID}/rows`, postBody);
  console.log('[Coda Feedback] Successfully wrote form response to Coda.');
}