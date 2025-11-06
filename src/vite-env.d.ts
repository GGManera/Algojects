/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Server-side only environment variables (no VITE_ prefix)
  // These are accessed via process.env in Vercel functions.
  // They are defined here for type safety in the API files.
  readonly CODA_API_KEY: string; // This is for the main project details API
  readonly CODA_DOC_ID: string;
  readonly CODA_PROJECT_TABLE_ID: string;
  // FEEDBACK API CONFIG (IDs are NOT VITE_ prefixed for server-side)
  readonly CODA_FEEDBACK_API_KEY: string;
  readonly CODA_FEEDBACK_DOC_ID: string;
  readonly CODA_FORM_STRUCTURE_TABLE_ID: string;
  readonly CODA_FORM_RESPONSES_TABLE_ID: string;
  readonly CODA_FORM_STRUCTURE_COLUMN_ID: string; // English JSON
  readonly CODA_FORM_STRUCTURE_PT_COLUMN_ID: string; // NEW: Portuguese JSON
  readonly CODA_FORM_RESPONSES_COLUMN_ID: string; // English Response JSON
  readonly CODA_FORM_RESPONSES_PT_COLUMN_ID: string; // NEW: Portuguese Response JSON
  readonly CODA_FORM_RESPONSES_LANGUAGE_COLUMN_ID: string; // NEW: Language Column
  readonly FEEDBACK_ADMIN_WALLET: string; // Server-side admin wallet
  readonly FEEDBACK_PROJECT_WALLET: string; // Server-side project wallet

  // Client-side environment variables (must have VITE_ prefix)
  readonly VITE_FEEDBACK_ADMIN_WALLET: string; // Client-side admin wallet (for auth checks)
  readonly VITE_FEEDBACK_PROJECT_WALLET: string; // Client-side project wallet (for display/auth checks)
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}