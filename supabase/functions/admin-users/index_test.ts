import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createCorsHeaders } from '../_shared/cors.ts'
import { createRuntimeHandler, createSupabaseDeps, requiredEnv } from './index.ts'

Deno.test('requiredEnv rejects a missing secret', () => {
  let message = ''
  try { requiredEnv({ SUPABASE_URL: 'http://localhost' }) }
  catch (error) { message = (error as Error).message }
  assertEquals(message, 'Missing Supabase admin environment')
})

Deno.test('requiredEnv reads the hosted secret-key map', () => {
  const env = requiredEnv({
    SUPABASE_URL: 'http://localhost',
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
  })
  assertEquals(env.secret, 'sb_secret_test')
})

Deno.test('cors never exposes credentials wildcard', () => {
  const corsHeaders = createCorsHeaders('https://dashboard.example.com')
  assertEquals(corsHeaders['Access-Control-Allow-Origin'] === '*' && corsHeaders['Access-Control-Allow-Credentials'] === 'true', false)
})

Deno.test('runtime returns CORS preflight without creating a request error', async () => {
  const handler = createRuntimeHandler({
    SUPABASE_URL: 'http://localhost', SUPABASE_SECRET_KEY: 'secret', ALLOWED_ORIGIN: 'https://dashboard.example.com',
  })
  const response = await handler(new Request('http://localhost', { method: 'OPTIONS' }))
  assertEquals(response.status, 204)
  assertEquals(response.headers.get('Access-Control-Allow-Origin'), 'https://dashboard.example.com')
})

Deno.test('adapter maps the database last-admin sentinel to a stable API error', async () => {
  const deps = createSupabaseDeps({
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      inviteUserByEmail: async () => ({ data: { user: null }, error: null }),
      updateUserById: async () => ({ data: { user: null }, error: { message: 'LAST_ADMIN_PROTECTED' } }),
      deleteUser: async () => ({ data: {}, error: { message: 'LAST_ADMIN_PROTECTED' } }),
    }, resetPasswordForEmail: async () => ({ data: {}, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }), update: () => ({ eq: async () => ({ error: null }) }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  } as any, {})
  await assertRejects(() => deps.updateUser('user-1', {}), Error, 'LAST_ADMIN_PROTECTED')
  await assertRejects(() => deps.deleteUser('user-1'), Error, 'LAST_ADMIN_PROTECTED')
})

Deno.test('adapter assigns the requested role in its single invitation call', async () => {
  let call: unknown
  const deps = createSupabaseDeps({
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      inviteUserByEmail: async (...args: unknown[]) => { call = args; return { data: { user: { id: 'u' } }, error: null } },
      updateUserById: async () => ({ data: { user: null }, error: null }), deleteUser: async () => ({ data: {}, error: null }),
    }, resetPasswordForEmail: async () => ({ data: {}, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }), update: () => ({ eq: async () => ({ error: null }) }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  } as any, { INVITE_REDIRECT_URL: 'https://dashboard.example.com/invite' })
  await deps.inviteUser('person@example.com', 'editor')
  assertEquals(call, ['person@example.com', { data: { app_role: 'editor' }, redirectTo: 'https://dashboard.example.com/invite' }])
})
