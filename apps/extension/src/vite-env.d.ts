/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOSS_USE_LOCAL_API?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
