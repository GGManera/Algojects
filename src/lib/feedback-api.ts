import { retryFetch } from '@/utils/api';
import { sha256 } from 'js-sha256';
import { FeedbackLanguage } from '@/contexts/FeedbackLanguageContext'; // Import FeedbackLanguage type

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

// NEW: Interface for the bilingual schema response
export interface BilingualFormStructureResponse {
    schema: {
        en: FormStructure;
        pt: FormStructure;
    }
}

// NEW: Interface for a single feedback response entry
export interface FeedbackResponseEntry {
  form_id: string;
  version: string;
  feedback_version: string;
  wallet_address: string;
  responses: Record<string, any>; // Key-value pairs of questionId to response
}

/**
 * Fetches the current master form structure JSON.
 */
export async function fetchFormStructure(): Promise<BilingualFormStructureResponse> {
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
export async function submitFormResponse(response: any, language: FeedbackLanguage): Promise<void> {
  const responseApi = await retryFetch('/api/form-responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ responseData: response, language }), // Pass responseData and language
  }, 5);

  // Read body only if needed for error logging, but since retryFetch handles errors, 
  // we just need to consume the body if successful (or let it be consumed by json())
  await responseApi.json();
}

/**
 * NEW: Creates a new Form Structure JSON version via POST request.
 * Expects an object containing both 'en' and 'pt' JSON strings.
 */
export async function createFormStructureClient(newJsonStrings: { en: string, pt: string }): Promise<void> {
  const response = await retryFetch('/api/form-structure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newJsonStrings), // Send the object containing both strings
  }, 5);
}

/**
 * Generates a local SHA-256 hash of the normalized JSON draft.
 * This is now only used for display/audit logging, not for on-chain verification.
 */
export function generateLocalHash(jsonDraft: FormStructure): string {
    // Remove rowId before hashing
    const { rowId, ...draftWithoutRowId } = jsonDraft;
    // For consistent hashing, sorting keys is still appropriate here.
    const normalizedJsonString = JSON.stringify(draftWithoutRowId, Object.keys(draftWithoutRowId).sort());
    return sha256(normalizedJsonString);
}

/**
 * NEW: Fetches all feedback responses.
 */
export async function fetchFormResponses(): Promise<FeedbackResponseEntry[]> {
  const response = await retryFetch('/api/feedback-responses-stats', undefined, 5);
  const data = await response.json();
  return data.responses;
}