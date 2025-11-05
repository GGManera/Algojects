import { VercelRequest, VercelResponse } from '@vercel/node';

// Constants for the Form Structure table
let CODA_FORM_STRUCTURE_COLUMN_JSON: string; 

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [key: string]: string; // Use index signature since the key is dynamic
  };
}

// Fallback structure if the Coda cell is empty
const FALLBACK_FORM_STRUCTURE = {
  form_id: "AlgoJects_Feedback_V1",
  version: "1.0.0",
  feedback_version: "1",
  authorized_wallet: process.env.VITE_FEEDBACK_ADMIN_WALLET || "ADMIN_WALLET_NOT_SET",
  project_wallet: process.env.VITE_FEEDBACK_PROJECT_WALLET || "PROJECT_WALLET_NOT_SET",
  hash_verification_required: true,
  metadata: {
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    description: "Initial dynamic feedback form structure. Please edit and commit via the Admin Editor.",
  },
  governance: {
    enabled: false,
    threshold_min_responses: 10,
    reward_eligibility: {
      min_posts: 1,
      min_balance_algo: 10,
      reward_amount_algo: 0.1,
    },
    versioning_policy: "MAJOR_MINOR",
  },
  modules: [
    {
      id: "m1",
      title: "General Experience",
      description: "Rate your overall experience with AlgoJects.",
      questions: [
        {
          id: "q1",
          type: "rating",
          question: "Overall satisfaction with the platform?",
          scale: 5,
          required: true,
        },
        {
          id: "q2",
          type: "text",
          question: "Any suggestions for improvement?",
          required: false,
        }
      ]
    }
  ],
  rendering_rules: {},
  audit: {
    last_edit: {
      hash: null,
      txid: null,
      editor_wallet: null,
      timestamp: null,
    },
  },
};


/**
 * Generic Coda API caller for the feedback system.
 */
export async function callCodaApi<T>(method: string, path: string, body?: any): Promise<T> {
  // Use dedicated feedback keys (now prefixed with VITE_)
  const CODA_API_KEY = process.env.CODA_FEEDBACK_API_KEY;
  const CODA_DOC_ID = process.env.CODA_FEEDBACK_DOC_ID;

  if (!CODA_API_KEY || !CODA_DOC_ID) {
    throw new Error('Coda Feedback API keys or IDs are not configured. Please check environment variables (CODA_FEEDBACK_API_KEY/CODA_FEEDBACK_DOC_ID).');
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
  CODA_FORM_STRUCTURE_COLUMN_JSON = process.env.CODA_FORM_STRUCTURE_COLUMN_ID || '';

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !CODA_FORM_STRUCTURE_COLUMN_JSON) {
    throw new Error('CODA_FORM_STRUCTURE_TABLE_ID or CODA_FORM_STRUCTURE_COLUMN_ID is not configured.');
  }

  // Fetch all rows (assuming only one row holds the master structure)
  const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`);

  if (!data.items || data.items.length === 0) {
    // If the table is completely empty, we still throw an error, as the setup is incomplete.
    throw new Error('Form Structure table is empty or misconfigured (no rows found).');
  }

  const masterRow = data.items[0];
  let jsonString = masterRow.values[CODA_FORM_STRUCTURE_COLUMN_JSON];
  const rowId = masterRow.id;

  if (!jsonString || jsonString.trim() === '') {
    console.warn("[Coda Feedback] Form Structure JSON column is empty. Returning fallback structure.");
    // If the column is empty, return the fallback structure as a string
    jsonString = JSON.stringify(FALLBACK_FORM_STRUCTURE);
  }

  return { jsonString, rowId };
}

/**
 * Updates the Form Structure JSON in Coda.
 */
export async function updateFormStructureInCoda(newJsonString: string, rowId: string): Promise<void> {
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.CODA_FORM_STRUCTURE_TABLE_ID;
  const columnId = process.env.CODA_FORM_STRUCTURE_COLUMN_ID;

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !columnId) {
    throw new Error('CODA_FORM_STRUCTURE_TABLE_ID or CODA_FORM_STRUCTURE_COLUMN_ID is not configured.');
  }

  const cells = [
    { column: columnId, value: newJsonString },
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
  // Since this is a new table, we need a placeholder. Let's use a generic one and assume the user will map it.
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