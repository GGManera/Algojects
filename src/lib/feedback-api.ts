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
 * Generates the SHA-256 hash of the new JSON draft.
 */
export async function generateHash(jsonDraft: FormStructure): Promise<{ hash: string; normalizedJsonString: string }> {
  const response = await retryFetch('/api/generate-hash', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(jsonDraft),
  }, 5);

  try {
      return response.json();
  } catch (e) {
      throw new Error("Failed to parse successful hash response as JSON.");
  }
}

/**
 * Verifies the Algorand transaction and triggers the Coda update if valid.
 */
export async function verifyTransactionAndCommit(txid: string, expectedHash: string, newJsonDraft: FormStructure): Promise<void> {
  const response = await retryFetch(`/api/verify-tx`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ txid, hash: expectedHash, newJsonDraft }),
  }, 5);

  // If retryFetch returns, the response is guaranteed to be response.ok
  // We can safely parse it as JSON.
  await response.json();
}