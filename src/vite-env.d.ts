/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CODA_API_KEY: string;
  readonly VITE_CODA_DOC_ID: string;
  readonly VITE_CODA_PROJECT_TABLE_ID: string;
  // NEW FEEDBACK FORM VARIABLES (Only wallets need VITE_ prefix for client access)
  readonly CODA_FORM_STRUCTURE_TABLE_ID: string;
  readonly CODA_FORM_RESPONSES_TABLE_ID: string;
  readonly VITE_FEEDBACK_ADMIN_WALLET: string;
  readonly VITE_FEEDBACK_PROJECT_WALLET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}