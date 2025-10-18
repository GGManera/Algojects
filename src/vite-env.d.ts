/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CODA_API_KEY: string;
  readonly VITE_CODA_DOC_ID: string;
  readonly VITE_CODA_PROJECT_TABLE_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}