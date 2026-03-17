/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPTILER_KEY: string;
  readonly VITE_PROXY_URL: string;
  readonly VITE_ANTHROPIC_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module 'dompurify' {
  const DOMPurify: {
    sanitize(source: string, config?: Record<string, unknown>): string;
  };
  export default DOMPurify;
}
