import { retryFetch } from '@/utils/api';
import { sha256 } from 'js-sha256';

// Define a estrutura básica do formulário (FormStructure)
export interface FormStructure {
  form_id: string;
  version: string;
  feedback_version: string;
  authorized_wallet: string;
  project_wallet: string;
  hash_verification_required: boolean;
  metadata: {
    created_at: string;
    updated_at: string;
    description: string;
  };
  governance: {
    enabled: boolean;
    threshold_min_responses: number;
    reward_eligibility: {
      min_posts: number;
      min_balance_algo: number;
      reward_amount_algo: number;
    };
    versioning_policy: string;
  };
  modules: any[]; // Simplified for now
  rendering_rules: any; // Simplified for now
  audit: {
    last_edit: {
      hash: string | null;
      txid: string | null;
      editor_wallet: string | null;
      timestamp: string | null;
    };
  };
  rowId?: string; // NEW: Include rowId in the structure returned by GET
}

/**
 * Fetches the current master form structure JSON.
 */
export async function fetchFormStructure(): Promise<FormStructure> {
  const response = await retryFetch('/api/form-structure', undefined, 5);
  
  // If response is OK, parse the body as JSON
  try {
      return response.json();
  } catch (e) {
      throw new Error("Failed to parse successful response as JSON.");
  }
}

/**
 * Submits a user response to the Form Responses table.
 */
export async function submitFormResponse(response: any): Promise<void> {
  const responseApi = await retryFetch('/api/form-responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(response),
  }, 5);

  // Read body only if needed for error logging, but since retryFetch handles errors, 
  // we just need to consume the body if successful (or let it be consumed by json())
  await responseApi.json();
}

/**
 * NEW: Creates a new Form Structure JSON version via POST request.
 */
export async function createFormStructureClient(newJsonDraft: FormStructure): Promise<void> {
  // Remove rowId before stringifying, as it's an internal Coda ID not part of the schema
  const { rowId, ...draftWithoutRowId } = newJsonDraft;
  
  // Normalize the JSON string and REMOVE PRETTY PRINTING to reduce payload size and complexity
  // We still sort keys for consistent hashing, but use no spacing (null, 0)
  const sortedKeys = Object.keys(draftWithoutRowId).sort();
  const newJsonString = JSON.stringify(draftWithoutRowId, sortedKeys); // Use standard stringify without pretty print
  
  const response = await retryFetch('/api/form-structure', {
    method: 'POST', // CHANGED to POST
    headers: { 'Content-Type': 'application/json' },
    body: newJsonString, // <--- ALTERADO: Envia a string JSON diretamente
  }, 5);

  await response.json();
}

/**
 * Generates a local SHA-256 hash of the normalized JSON draft.
 * This is now only used for display/audit logging, not for on-chain verification.
 */
export function generateLocalHash(jsonDraft: FormStructure): string {
    // Remove rowId before hashing
    const { rowId, ...draftWithoutRowId } = jsonDraft;
    // Use the same normalization logic as the server (if it fosse still running)
    const normalizedJsonString = JSON.stringify(draftWithoutRowId, Object.keys(draftWithoutRowId).sort()); // Use compact stringify for hashing
    return sha256(normalizedJsonString);
}