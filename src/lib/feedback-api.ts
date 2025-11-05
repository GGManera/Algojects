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
}

/**
 * Fetches the current master form structure JSON.
 */
export async function fetchFormStructure(): Promise<FormStructure> {
  const response = await retryFetch('/api/form-structure', undefined, 5);
  
  // Read the body text once, regardless of status
  const responseText = await response.text(); 

  if (!response.ok) {
    let errorText = `Failed to fetch form structure: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText); // Try to parse the text
      errorText = errorData.error || errorText;
    } catch (e) {
      // If parsing fails, use the raw text as the error message
      errorText = responseText || errorText;
    }
    throw new Error(errorText);
  }
  
  // If response is OK, parse the text as JSON
  try {
      return JSON.parse(responseText);
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

  const responseText = await responseApi.text();

  if (!responseApi.ok) {
    let errorText = `Failed to submit response: ${responseApi.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = responseText || errorText;
    }
    throw new Error(errorText);
  }
}

/**
 * Generates the SHA-256 hash of the new JSON draft.
 */
export async function generateHash(jsonDraft: FormStructure): Promise<{ hash: string; normalizedJsonString: string }> {
  const response = await retryFetch('/api/generate-hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonDraft),
  }, 5);

  const responseText = await response.text();

  if (!response.ok) {
    let errorText = `Failed to generate hash: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = responseText || errorText;
    }
    throw new Error(errorText);
  }
  
  try {
      return JSON.parse(responseText);
  } catch (e) {
      throw new Error("Failed to parse successful hash response as JSON.");
  }
}

/**
 * Verifies the Algorand transaction and triggers the Coda update if valid.
 */
export async function verifyTransactionAndCommit(txid: string, expectedHash: string, newJsonDraft: FormStructure): Promise<void> {
  const response = await retryFetch(`/api/verify-tx`, { // Removed query string, using body
    method: 'POST', // CHANGED from GET to POST
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid, hash: expectedHash, newJsonDraft }), // Send all data in body
  }, 5);

  const responseText = await response.text();

  if (!response.ok) {
    let errorText = `Transaction verification failed: ${response.status}`;
    try {
      const errorData = JSON.parse(responseText);
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = responseText || errorText;
    }
    throw new Error(errorText);
  }
}

/**
 * Utility to generate the hash locally (for display/comparison)
 */
export function generateLocalHash(jsonDraft: FormStructure): string {
    // Ensure the same normalization logic as the server
    const normalizedJsonString = JSON.stringify(jsonDraft, Object.keys(jsonDraft).sort(), 2);
    return sha256(normalizedJsonString);
}