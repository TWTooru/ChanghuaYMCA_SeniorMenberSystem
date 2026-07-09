import { describe, expect, it } from 'vitest'
import { resolveSupabaseConfig, supabase } from './supabaseClient'

describe('supabaseClient', () => {
  it('creates the shared client', () => {
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })

  it('allows development fallback values outside production', () => {
    expect(resolveSupabaseConfig({ PROD: false })).toEqual({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'dummy-key'
    })
  })

  it('rejects missing production Supabase URL', () => {
    expect(() => resolveSupabaseConfig({
      PROD: true,
      VITE_SUPABASE_ANON_KEY: 'real-anon-key'
    })).toThrow('VITE_SUPABASE_URL is required for production builds')
  })

  it('rejects placeholder production Supabase anon key', () => {
    expect(() => resolveSupabaseConfig({
      PROD: true,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dummy-key'
    })).toThrow('VITE_SUPABASE_ANON_KEY is required for production builds')
  })
})
