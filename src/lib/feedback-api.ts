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
  
  if (!response.ok) {
    let errorText = `Failed to fetch form structure: ${response.status}`;
    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch (e) {
      // If response is not JSON, read as text
      errorText = await response.text();
    }
    throw new Error(errorText);
  }
  
  // Read JSON only if response is OK
  return response.json();
}

/**
 * Submits a user response to the Form Responses table.
 */
export async function submitFormResponse(response: any): Promise<void> {
  const responseBody = {
    ...response,
    submitted_at: new Date().toISOString(),
  };
  
  const responseApi = await retryFetch('/api/form-responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(responseBody),
  }, 5);

  if (!responseApi.ok) {
    let errorText = `Failed to submit response: ${responseApi.status}`;
    try {
      const errorData = await responseApi.json();
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = await responseApi.text();
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

  if (!response.ok) {
    let errorText = `Failed to generate hash: ${response.status}`;
    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = await response.text();
    }
    throw new Error(errorText);
  }
  return response.json();
}

/**
 * Verifies the Algorand transaction and triggers the Coda update if valid.
 */
export async function verifyTransactionAndCommit(txid: string, expectedHash: string, newJsonDraft: FormStructure): Promise<void> {
  const response = await retryFetch(`/api/verify-tx?txid=${txid}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hash: expectedHash, newJsonDraft }),
  }, 5);

  if (!response.ok) {
    let errorText = `Transaction verification failed: ${response.status}`;
    try {
      const errorData = await response.json();
      errorText = errorData.error || errorText;
    } catch (e) {
      errorText = await response.text();
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