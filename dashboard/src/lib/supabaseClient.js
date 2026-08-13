import { createClient } from '@supabase/supabase-js'
import { detectPasswordFlow } from './authFlow'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Supabase 設定錯誤：請確認 VITE_SUPABASE_URL 與 VITE_SUPABASE_PUBLISHABLE_KEY')
}

export const initialPasswordFlow = typeof window === 'undefined'
  ? null
  : detectPasswordFlow(window.location)

export const supabase = createClient(supabaseUrl, supabasePublishableKey)
