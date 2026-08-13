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
  it('creates the shared client with the Vite Supabase URL and publishable key', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://nychrjrezpuxwuurpcvh.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key')

    await import('./supabaseClient')

    expect(createClient).toHaveBeenCalledWith(
      'https://nychrjrezpuxwuurpcvh.supabase.co',
      'publishable-test-key'
    )
  })

  it('captures an invite callback before the Supabase client clears the URL fragment', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://nychrjrezpuxwuurpcvh.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key')
    window.history.replaceState({}, '', '/#access_token=invite-token&refresh_token=refresh-token&type=invite')
    createClient.mockImplementationOnce(() => {
      window.history.replaceState({}, '', '/')
      return { auth: {} }
    })

    const { initialPasswordFlow } = await import('./supabaseClient')

    expect(initialPasswordFlow).toBe('invite')
    expect(window.location.hash).toBe('')
  })

  it('throws a Chinese configuration error when the Supabase URL is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-test-key')

    await expect(import('./supabaseClient')).rejects.toThrow('Supabase 設定錯誤')
  })

  it('throws a Chinese configuration error when the Supabase publishable key is missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://nychrjrezpuxwuurpcvh.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')

    await expect(import('./supabaseClient')).rejects.toThrow('Supabase 設定錯誤')
  })
})
