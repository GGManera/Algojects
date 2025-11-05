import { VercelRequest, VercelResponse } from '@vercel/node';

// Constants for the Form Structure table
const CODA_FORM_STRUCTURE_COLUMN_JSON = 'c-ftTZjCuByP'; // Assuming a single column for the JSON content

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [CODA_FORM_STRUCTURE_COLUMN_JSON]: string;
  };
}

/**
 * Generic Coda API caller for the feedback system.
 */
export async function callCodaApi<T>(method: string, path: string, body?: any): Promise<T> {
  const CODA_API_KEY = process.env.CODA_API_KEY;
  const CODA_DOC_ID = process.env.CODA_DOC_ID;

  if (!CODA_API_KEY || !CODA_DOC_ID) {
    throw new Error('Coda API keys or IDs are not configured. Please check environment variables.');
  }

  const url = `https://coda.io/apis/v1/docs/${CODA_DOC_ID}${path}`;
  const headers = {
    'Authorization': `Bearer ${CODA_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const stringifiedBody = body ? JSON.stringify(body) : undefined;

  const response = await fetch(url, {
    method,
    headers,
    body: stringifiedBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Coda API Error (${method} ${path}): ${response.status} - ${errorText}`);
    throw new Error(`Coda API responded with status ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches the current Form Structure JSON from Coda.
 * Returns the JSON string and the Coda Row ID.
 */
export async function fetchFormStructureFromCoda(): Promise<{ jsonString: string; rowId: string }> {
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.CODA_FORM_STRUCTURE_TABLE_ID;
  if (!CODA_FORM_STRUCTURE_TABLE_ID) {
    throw new Error('CODA_FORM_STRUCTURE_TABLE_ID is not configured.');
  }

  // Fetch all rows (assuming only one row holds the master structure)
  const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`);

  if (!data.items || data.items.length === 0) {
    throw new Error('Form Structure table is empty or misconfigured.');
  }

  const masterRow = data.items[0];
  const jsonString = masterRow.values[CODA_FORM_STRUCTURE_COLUMN_JSON];

  if (!jsonString) {
    throw new Error('Form Structure JSON column is empty.');
  }

  return { jsonString, rowId: masterRow.id };
}

/**
 * Updates the Form Structure JSON in Coda.
 */
export async function updateFormStructureInCoda(newJsonString: string, rowId: string): Promise<void> {
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.CODA_FORM_STRUCTURE_TABLE_ID;
  if (!CODA_FORM_STRUCTURE_TABLE_ID) {
    throw new Error('CODA_FORM_STRUCTURE_TABLE_ID is not configured.');
  }

  const cells = [
    { column: CODA_FORM_STRUCTURE_COLUMN_JSON, value: newJsonString },
  ];

  const putBody = {
    row: { cells },
  };

  await callCodaApi('PUT', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows/${rowId}`, putBody);
}

/**
 * Writes a new user response to the Form Responses table.
 */
export async function writeFormResponseToCoda(responseJson: any): Promise<void> {
  const CODA_FORM_RESPONSES_TABLE_ID = process.env.CODA_FORM_RESPONSES_TABLE_ID;
  if (!CODA_FORM_RESPONSES_TABLE_ID) {
    throw new Error('CODA_FORM_RESPONSES_TABLE_ID is not configured.');
  }

  // Assuming the Form Responses table has a column named 'Response JSON' (c-ftTZjCuByP is a placeholder, but we must use a known column ID)
  const CODA_COLUMN_RESPONSE_JSON = 'c-response-json'; 

  const postBody = {
    rows: [
      {
        cells: [
          { column: CODA_COLUMN_RESPONSE_JSON, value: JSON.stringify(responseJson) },
        ],
      },
    ],
  };

  await callCodaApi('POST', `/tables/${CODA_FORM_RESPONSES_TABLE_ID}/rows`, postBody);
}