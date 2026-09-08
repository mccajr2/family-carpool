/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  /** Optional Maps Embed key for ride-detail route map; omit → placeholder. */
  readonly VITE_GOOGLE_MAPS_EMBED_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
