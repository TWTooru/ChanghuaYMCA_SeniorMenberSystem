import { createClient } from '@supabase/supabase-js'

const DEFAULT_SUPABASE_URL = 'http://localhost:54321'
const DEFAULT_SUPABASE_ANON_KEY = 'dummy-key'

function isMissingProductionValue(value, placeholder) {
  return !value || value === placeholder
}

export function resolveSupabaseConfig(env) {
  const supabaseUrl = env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL
  const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY

  if (env.PROD && isMissingProductionValue(supabaseUrl, DEFAULT_SUPABASE_URL)) {
    throw new Error('VITE_SUPABASE_URL is required for production builds')
  }

  if (env.PROD && isMissingProductionValue(supabaseAnonKey, DEFAULT_SUPABASE_ANON_KEY)) {
    throw new Error('VITE_SUPABASE_ANON_KEY is required for production builds')
  }

  return { supabaseUrl, supabaseAnonKey }
}

const { supabaseUrl, supabaseAnonKey } = resolveSupabaseConfig(import.meta.env)

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
