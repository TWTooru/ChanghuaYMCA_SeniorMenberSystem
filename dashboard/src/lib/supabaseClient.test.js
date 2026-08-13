import { afterEach, describe, expect, it, vi } from 'vitest'

const createClient = vi.fn(() => ({ auth: {} }))

vi.mock('@supabase/supabase-js', () => ({ createClient }))

afterEach(() => {
  createClient.mockClear()
  vi.unstubAllEnvs()
  vi.resetModules()
  window.history.replaceState({}, '', '/')
})

describe('supabaseClient', () => {
  it('creates the shared client', async () => {
    const { supabase } = await import('./supabaseClient')

    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
  })

  it('allows development fallback values outside production', async () => {
    const { resolveSupabaseConfig } = await import('./supabaseClient')

    expect(resolveSupabaseConfig({ PROD: false })).toEqual({
      supabaseUrl: 'http://localhost:54321',
      supabaseAnonKey: 'dummy-key'
    })
  })

  it('rejects missing production Supabase URL', async () => {
    const { resolveSupabaseConfig } = await import('./supabaseClient')

    expect(() => resolveSupabaseConfig({
      PROD: true,
      VITE_SUPABASE_ANON_KEY: 'real-anon-key'
    })).toThrow('VITE_SUPABASE_URL is required for production builds')
  })

  it('rejects placeholder production Supabase anon key', async () => {
    const { resolveSupabaseConfig } = await import('./supabaseClient')

    expect(() => resolveSupabaseConfig({
      PROD: true,
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'dummy-key'
    })).toThrow('VITE_SUPABASE_ANON_KEY is required for production builds')
  })

  it('captures an invite callback before the Supabase client clears the URL fragment', async () => {
    window.history.replaceState({}, '', '/#access_token=invite-token&refresh_token=refresh-token&type=invite')
    createClient.mockImplementationOnce(() => {
      window.history.replaceState({}, '', '/')
      return { auth: {} }
    })

    const { initialPasswordFlow } = await import('./supabaseClient')

    expect(initialPasswordFlow).toBe('invite')
    expect(window.location.hash).toBe('')
  })
})
