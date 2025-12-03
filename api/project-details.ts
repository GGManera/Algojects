import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ProjectMetadata, MetadataItem } from '../src/types/project'; // Import ProjectMetadata and MetadataItem

// Mapeamento dos IDs internos do Coda para as colunas
const CODA_COLUMN_PROJECT_ID = 'c-ftTZjCuByP';
const CODA_COLUMN_PROJECT_METADATA = 'c-67txVpYgUS'; // This column will now store a JSON string with ALL project details

export interface ProjectDetailsEntry {
  projectId: string;
  projectMetadata: ProjectMetadata; // Changed type to ProjectMetadata
  rowId?: string; // Coda's internal row ID for updates
}

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [CODA_COLUMN_PROJECT_ID]: string;
    [CODA_COLUMN_PROJECT_METADATA]: string;
  };
}

async function callCodaApi<T>(method: string, path: string, body?: any): Promise<T> {
  const CODA_API_KEY = process.env.CODA_API_KEY;
  const CODA_DOC_ID = process.env.CODA_DOC_ID;
  const CODA_PROJECT_TABLE_ID = process.env.CODA_PROJECT_TABLE_ID;

  console.log(`[Coda API] CODA_API_KEY present: ${!!CODA_API_KEY && CODA_API_KEY !== 'SUA_CHAVE_API_CODA_AQUI'}`);
  console.log(`[Coda API] CODA_DOC_ID: ${CODA_DOC_ID}`);
  console.log(`[Coda API] CODA_PROJECT_TABLE_ID: ${CODA_PROJECT_TABLE_ID}`);


  if (!CODA_API_KEY || !CODA_DOC_ID || !CODA_PROJECT_TABLE_ID) {
    throw new Error('Coda API keys or IDs are not configured. Please check environment variables.');
  }

  const url = `https://coda.io/apis/v1/docs/${CODA_DOC_ID}${path}`;
  const headers = {
    'Authorization': `Bearer ${CODA_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const stringifiedBody = body ? JSON.stringify(body, null, 2) : undefined;

  console.log(`[Coda API] Making request to: ${url}`);
  console.log(`[Coda API] Method: ${method}`);
  console.log(`[Coda API] Headers (excluding Authorization): ${JSON.stringify({ 'Content-Type': 'application/json' }, null, 2)}`); 
  if (stringifiedBody) {
    console.log(`[Coda API] Request Body: ${stringifiedBody}`);
  } else {
    console.log(`[Coda API] Request Body: (none)`);
  }

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

async function fetchProjectDetailsFromCoda(): Promise<ProjectDetailsEntry[]> {
  const CODA_PROJECT_TABLE_ID = process.env.CODA_PROJECT_TABLE_ID;
  if (!CODA_PROJECT_TABLE_ID) {
    throw new Error('CODA_PROJECT_TABLE_ID is not configured. Please check environment variables.');
  }
  const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_PROJECT_TABLE_ID}/rows`);
  
  console.log("[Coda API] Raw rows from Coda:", data.items.map(row => row.values));

  return data.items.map(row => {
    let parsedMetadata: ProjectMetadata = [];
    const metadataString = row.values[CODA_COLUMN_PROJECT_METADATA] || '[]';
    try {
      parsedMetadata = JSON.parse(metadataString);
      // Ensure each item has at least title and value
      parsedMetadata = parsedMetadata.map((item: any) => ({
        title: item.title || '',
        value: item.value || '',
        type: item.type || undefined,
      }));
    } catch (e) {
      console.error(`Failed to parse project metadata for project ${row.values[CODA_COLUMN_PROJECT_ID]}:`, e);
      parsedMetadata = []; // Fallback to empty array on parse error
    }

    return {
      projectId: row.values[CODA_COLUMN_PROJECT_ID],
      projectMetadata: parsedMetadata, // Use the parsed object
      rowId: row.id,
    };
  });
}

async function updateProjectDetailsInCoda(
  projectId: string, 
  projectMetadata: ProjectMetadata // Now takes the full metadata array
): Promise<void> {
  const existingDetails = await fetchProjectDetailsFromCoda();
  const targetRow = existingDetails.find(entry => entry.projectId === projectId);

  console.log(`[Coda API] Debugging update: projectId='${projectId}', targetRow found: ${!!targetRow}, targetRow.rowId: ${targetRow?.rowId}`);

  const CODA_PROJECT_TABLE_ID = process.env.CODA_PROJECT_TABLE_ID;
  if (!CODA_PROJECT_TABLE_ID) {
    throw new Error('CODA_PROJECT_TABLE_ID is not configured. Please check environment variables.');
  }

  const cells = [
    { column: CODA_COLUMN_PROJECT_ID, value: projectId },
    { column: CODA_COLUMN_PROJECT_METADATA, value: JSON.stringify(projectMetadata) }, // Stringify the JSON array
  ];

  if (!targetRow || !targetRow.rowId) {
    console.log(`[Coda API] Project ID '${projectId}' not found or missing rowId. Attempting to CREATE new row (POST).`);
    const postBody = {
      rows: [
        { cells },
      ],
    };
    console.log("[Coda API] Sending POST request to create row with body:", JSON.stringify(postBody, null, 2));
    await callCodaApi('POST', `/tables/${CODA_PROJECT_TABLE_ID}/rows`, postBody);
    console.log(`Created new Coda row for Project ID: ${projectId}`);
  } else {
    console.log(`[Coda API] Project ID '${projectId}' found (rowId: ${targetRow.rowId}). Attempting to UPDATE existing row (PUT).`);
    const putBody = {
      row: { cells },
    };
    console.log("[Coda API] Sending PUT request to update row with body:", JSON.stringify(putBody, null, 2));
    await callCodaApi('PUT', `/tables/${CODA_PROJECT_TABLE_ID}/rows/${targetRow.rowId}`, putBody);
    console.log(`Updated Coda row for Project ID: ${projectId}`);
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  console.log("[Vercel API Handler] Incoming request body:", request.body);
  try {
    if (request.method === 'GET') {
      const projectDetails = await fetchProjectDetailsFromCoda();
      return response.status(200).json({ projectDetails });
    } else if (request.method === 'POST') {
      // Ensure request.body is an object before destructuring
      const body = request.body || {};
      const { projectId, projectMetadata } = body; 
      
      // Log the received data for debugging
      console.log(`[Vercel API Handler] Received projectId: ${projectId}`);
      console.log(`[Vercel API Handler] Received projectMetadata type: ${typeof projectMetadata}`);
      console.log(`[Vercel API Handler] Received projectMetadata length: ${Array.isArray(projectMetadata) ? projectMetadata.length : 'N/A'}`);

      if (!projectId || projectMetadata === undefined) {
        return response.status(400).json({ error: 'Missing projectId or projectMetadata in request body.' });
      }
      await updateProjectDetailsInCoda(projectId, projectMetadata);
      return response.status(200).json({ message: 'Project details updated successfully.' });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in Coda API handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}