/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Undefined when the build was not given credentials - the app shows a
  // configuration hint instead of crashing.
  readonly VITE_SUPABASE_URL: string | undefined
  readonly VITE_SUPABASE_ANON_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
