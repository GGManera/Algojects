/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CODA_API_KEY: string; // This is for the main project details API
  readonly VITE_CODA_DOC_ID: string;
  readonly VITE_CODA_PROJECT_TABLE_ID: string;
  // FEEDBACK API CONFIG (IDs are VITE_ prefixed, keys are not)
  readonly VITE_CODA_FEEDBACK_DOC_ID: string; // NEW: Document ID for feedback
  readonly VITE_CODA_FORM_STRUCTURE_TABLE_ID: string;
  readonly VITE_CODA_FORM_RESPONSES_TABLE_ID: string;
  readonly VITE_CODA_FORM_STRUCTURE_COLUMN_ID: string; // NEW: Column ID for the JSON content
  readonly VITE_FEEDBACK_ADMIN_WALLET: string;
  readonly VITE_FEEDBACK_PROJECT_WALLET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}