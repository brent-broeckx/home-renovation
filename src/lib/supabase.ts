import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const fallbackSupabaseUrl = 'https://placeholder.supabase.co'
const fallbackSupabaseAnonKey = 'placeholder-anon-key'

/**
 * True when the build was given Supabase credentials. The app renders a
 * configuration hint instead of crashing when they are missing.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Browser Supabase client.
 *
 * Only the anon/publishable key is ever used here - it is safe to ship in a
 * public static bundle because every table is protected by Row Level Security
 * policies scoped to `auth.uid()`. Never put the service_role key in this file.
 */
export const supabase = createClient(
  supabaseUrl || fallbackSupabaseUrl,
  supabaseAnonKey || fallbackSupabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'renovation-tracker-auth',
    },
  },
)
