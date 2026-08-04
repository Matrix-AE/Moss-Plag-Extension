/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOSS_USE_LOCAL_API?: string;
  readonly VITE_MOSS_API_ORIGIN?: string;
  readonly VITE_MOSS_UPLOAD_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
