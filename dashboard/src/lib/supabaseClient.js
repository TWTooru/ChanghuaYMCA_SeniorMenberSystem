import { createClient } from '@supabase/supabase-js'

/**
 * 驗證 Vite 注入的 Supabase public 設定並建立瀏覽器共用 client。
 * production 禁止沿用本機預設值，避免正式環境默默連到錯誤專案。
 */
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
