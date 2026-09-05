import { assertEquals, assertRejects } from 'jsr:@std/assert'
import { createCorsHeaders } from '../_shared/cors.ts'
import { ApiError } from './domain.ts'
import { createRuntimeHandler, createSupabaseDeps, requiredEnv } from './index.ts'

type QueryResult = { data: unknown; error: unknown }

function roleTableFake(results: {
  get?: QueryResult
  list?: QueryResult
  update?: QueryResult
  count?: QueryResult & { count?: unknown }
  fromError?: unknown
} = {}) {
  const calls: unknown[][] = []
  let queryKind: 'read' | 'count' | 'update' = 'read'
  const builder: Record<string, (...args: unknown[]) => unknown> = {
    select(...args: unknown[]) {
      calls.push(['select', ...args])
      if ((args[1] as { head?: unknown } | undefined)?.head === true) queryKind = 'count'
      return builder
    },
    eq(column: unknown, value: unknown) {
      calls.push(['eq', column, value])
      if (queryKind === 'count' && column === 'role' && value === 'owner') {
        return Promise.resolve(results.count ?? { data: null, error: null, count: 0 })
      }
      return builder
    },
    in(column: unknown, values: unknown) {
      calls.push(['in', column, values])
      return Promise.resolve(results.list ?? { data: [], error: null })
    },
    update(attributes: unknown) {
      calls.push(['update', attributes])
      queryKind = 'update'
      return builder
    },
    maybeSingle() {
      calls.push(['maybeSingle'])
      return Promise.resolve(
        queryKind === 'update'
          ? results.update ?? { data: null, error: null }
          : results.get ?? { data: null, error: null },
      )
    },
    single() {
      calls.push(['single'])
      return Promise.resolve(results.update ?? { data: null, error: null })
    },
  }
  return {
    calls,
    client: {
      from(table: string) {
        calls.push(['from', table])
        if (results.fromError) throw results.fromError
        return builder
      },
    },
  }
}

async function assertRoleStoreError(operation: () => Promise<unknown>) {
  const error = await assertRejects(operation, ApiError, 'ROLE_STORE_ERROR')
  assertEquals((error as ApiError).code, 'ROLE_STORE_ERROR')
  assertEquals(error.message, 'ROLE_STORE_ERROR')
}

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

// hosted bundle 與舊版 service-role key 同時存在時，維持既有 Auth Admin 的安全相容性。
Deno.test('requiredEnv prioritizes the legacy service-role key for Auth Admin calls', () => {
  const env = requiredEnv({
    SUPABASE_URL: 'http://localhost',
    SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-key',
    SUPABASE_SECRET_KEYS: JSON.stringify({ default: 'sb_secret_test' }),
  })
  assertEquals(env.secret, 'legacy-service-role-key')
})

// CORS 不可同時回傳 wildcard origin 與 credentials，runtime 亦會拒絕 `ALLOWED_ORIGIN=*`。
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

// Supabase Auth 的暫態 email rate-limit 訊息必須收斂為 domain 可處理的穩定代碼。
Deno.test('adapter maps the Auth email rate limit to a stable API error', async () => {
  const rateLimitError = Object.assign(new Error('email rate limit exceeded'), { status: 429 })
  const deps = createSupabaseDeps({
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      inviteUserByEmail: async () => ({ data: { user: null }, error: rateLimitError }),
      deleteUser: async () => ({ data: {}, error: null }),
    }, resetPasswordForEmail: async () => ({ data: {}, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }), update: () => ({ eq: async () => ({ error: null }) }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  } as any, {})

  await assertRejects(() => deps.inviteUser('person@example.com'), Error, 'EMAIL_RATE_LIMITED')
})

// 邀請流程只傳遞 redirect 環境設定，不附加會覆寫既有帳號角色模型的 app metadata。
Deno.test('adapter sends invite without app role metadata', async () => {
  let call: unknown
  const deps = createSupabaseDeps({
    auth: { getUser: async () => ({ data: { user: null }, error: null }), admin: {
      listUsers: async () => ({ data: { users: [] }, error: null }),
      inviteUserByEmail: async (...args: unknown[]) => { call = args; return { data: { user: { id: 'u' } }, error: null } },
      deleteUser: async () => ({ data: {}, error: null }),
    }, resetPasswordForEmail: async () => ({ data: {}, error: null }) },
    from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }), update: () => ({ eq: async () => ({ error: null }) }), select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  } as any, { INVITE_REDIRECT_URL: 'https://dashboard.example.com/invite' })
  await deps.inviteUser('person@example.com')
  assertEquals(call, ['person@example.com', { redirectTo: 'https://dashboard.example.com/invite' }])
})

Deno.test('getRole emits the exact single-role query and maps a stored role', async () => {
  const fake = roleTableFake({ get: { data: { role: 'admin' }, error: null } })
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.getRole('admin-id'), 'admin')
  assertEquals(fake.calls, [
    ['from', 'app_user_roles'],
    ['select', 'role'],
    ['eq', 'user_id', 'admin-id'],
    ['maybeSingle'],
  ])
})

Deno.test('getRole maps a missing database row to null', async () => {
  const fake = roleTableFake({ get: { data: null, error: null } })
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.getRole('missing-id'), null)
})

Deno.test('countOwners emits the exact owner-count query', async () => {
  const fake = roleTableFake({ count: { data: null, error: null, count: 2 } })
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.countOwners(), 2)
  assertEquals(fake.calls, [
    ['from', 'app_user_roles'],
    ['select', 'user_id', { count: 'exact', head: true }],
    ['eq', 'role', 'owner'],
  ])
})

Deno.test('countOwners rejects missing, malformed, and negative counts', async () => {
  for (const count of [undefined, null, '2', Number.NaN, Number.POSITIVE_INFINITY, -1]) {
    const fake = roleTableFake({ count: { data: null, error: null, count } })
    const deps = createSupabaseDeps(fake.client as any, {})

    await assertRoleStoreError(() => deps.countOwners())
  }
})

Deno.test('listRoles skips the database for an empty user list', async () => {
  const fake = roleTableFake()
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.listRoles([]), [])
  assertEquals(fake.calls, [])
})

Deno.test('listRoles emits one IN query and maps every database row', async () => {
  const fake = roleTableFake({
    list: {
      data: [
        { user_id: 'owner-id', role: 'owner' },
        { user_id: 'admin-id', role: 'admin' },
      ],
      error: null,
    },
  })
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.listRoles(['owner-id', 'admin-id']), [
    { userId: 'owner-id', role: 'owner' },
    { userId: 'admin-id', role: 'admin' },
  ])
  assertEquals(fake.calls, [
    ['from', 'app_user_roles'],
    ['select', 'user_id,role'],
    ['in', 'user_id', ['owner-id', 'admin-id']],
  ])
})

Deno.test('listRoles rejects rows without a non-empty string user_id', async () => {
  for (const row of [
    { role: 'admin' },
    { user_id: '', role: 'admin' },
    { user_id: 42, role: 'admin' },
  ]) {
    const fake = roleTableFake({ list: { data: [row], error: null } })
    const deps = createSupabaseDeps(fake.client as any, {})
    await assertRoleStoreError(() => deps.listRoles(['requested-id']))
  }
})

Deno.test('updateRole emits one update query and validates the returned row', async () => {
  const fake = roleTableFake({
    update: { data: { user_id: 'admin-id', role: 'editor' }, error: null },
  })
  const deps = createSupabaseDeps(fake.client as any, {})

  assertEquals(await deps.updateRole('admin-id', 'editor', 'admin'), {
    userId: 'admin-id',
    role: 'editor',
  })
  assertEquals(fake.calls[0], ['from', 'app_user_roles'])
  assertEquals(fake.calls[1][0], 'update')
  const updatePayload = fake.calls[1][1] as Record<string, unknown>
  assertEquals(Object.keys(updatePayload).sort(), ['role', 'updated_at'])
  assertEquals(updatePayload.role, 'editor')
  assertEquals(Number.isNaN(Date.parse(updatePayload.updated_at as string)), false)
  assertEquals(fake.calls.slice(2), [
    ['eq', 'user_id', 'admin-id'],
    ['eq', 'role', 'admin'],
    ['select', 'user_id,role'],
    ['maybeSingle'],
  ])
})

Deno.test('deleteUser reserves the expected role before calling Auth Admin', async () => {
  const calls: unknown[][] = []
  const reservedRole = {
    user_id: 'viewer-id',
    role: 'viewer',
    created_at: '2026-09-05T00:00:00.000Z',
    updated_at: '2026-09-05T01:00:00.000Z',
  }
  const reserveBuilder: Record<string, (...args: unknown[]) => unknown> = {
    delete() {
      calls.push(['delete'])
      return reserveBuilder
    },
    eq(...args: unknown[]) {
      calls.push(['eq', ...args])
      return reserveBuilder
    },
    select(...args: unknown[]) {
      calls.push(['select', ...args])
      return reserveBuilder
    },
    maybeSingle() {
      calls.push(['maybeSingle'])
      return Promise.resolve({ data: reservedRole, error: null })
    },
    insert(...args: unknown[]) {
      calls.push(['insert', ...args])
      return Promise.resolve({ data: null, error: null })
    },
  }
  const deps = createSupabaseDeps({
    from(table: string) {
      calls.push(['from', table])
      return reserveBuilder
    },
    auth: { admin: { deleteUser: async (...args: unknown[]) => {
      calls.push(['auth.deleteUser', ...args])
      return { data: {}, error: null }
    } } },
  } as any, {})

  await deps.deleteUser('viewer-id', 'viewer')

  assertEquals(calls, [
    ['from', 'app_user_roles'],
    ['delete'],
    ['eq', 'user_id', 'viewer-id'],
    ['eq', 'role', 'viewer'],
    ['select', 'user_id,role,created_at,updated_at'],
    ['maybeSingle'],
    ['auth.deleteUser', 'viewer-id'],
  ])
})

Deno.test('deleteUser restores the reserved role before propagating an Auth failure', async () => {
  const calls: unknown[][] = []
  const reservedRole = {
    user_id: 'viewer-id',
    role: 'viewer',
    created_at: '2026-09-05T00:00:00.000Z',
    updated_at: '2026-09-05T01:00:00.000Z',
  }
  const reserveBuilder: Record<string, (...args: unknown[]) => unknown> = {
    delete() {
      calls.push(['delete'])
      return reserveBuilder
    },
    eq(...args: unknown[]) {
      calls.push(['eq', ...args])
      return reserveBuilder
    },
    select(...args: unknown[]) {
      calls.push(['select', ...args])
      return reserveBuilder
    },
    maybeSingle() {
      calls.push(['maybeSingle'])
      return Promise.resolve({ data: reservedRole, error: null })
    },
    insert(...args: unknown[]) {
      calls.push(['insert', ...args])
      return Promise.resolve({ data: null, error: null })
    },
  }
  const deps = createSupabaseDeps({
    from(table: string) {
      calls.push(['from', table])
      return reserveBuilder
    },
    auth: { admin: { deleteUser: async (...args: unknown[]) => {
      calls.push(['auth.deleteUser', ...args])
      return { data: {}, error: new Error('Auth unavailable') }
    } } },
  } as any, {})

  const error = await assertRejects(
    () => deps.deleteUser('viewer-id', 'viewer'),
    ApiError,
    'SUPABASE_AUTH_ERROR',
  )

  assertEquals((error as ApiError).code, 'SUPABASE_AUTH_ERROR')
  assertEquals(calls.at(-2), ['from', 'app_user_roles'])
  assertEquals(calls.at(-1), ['insert', reservedRole])
})

Deno.test('deleteUser never calls Auth when the expected role reservation misses', async () => {
  let authCalled = false
  const reserveBuilder: Record<string, (...args: unknown[]) => unknown> = {
    delete: () => reserveBuilder,
    eq: () => reserveBuilder,
    select: () => reserveBuilder,
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
  }
  const deps = createSupabaseDeps({
    from: () => reserveBuilder,
    auth: { admin: { deleteUser: async () => {
      authCalled = true
      return { data: {}, error: null }
    } } },
  } as any, {})

  await assertRoleStoreError(() => deps.deleteUser('viewer-id', 'viewer'))
  assertEquals(authCalled, false)
})

Deno.test('role-table query errors map to stable ROLE_STORE_ERROR', async () => {
  for (const [operation, results] of [
    ['get', { get: { data: null, error: { message: 'select failed', details: 'secret' } } }],
    ['count', { count: { data: null, error: { message: 'count failed', details: 'secret' }, count: undefined } }],
    ['list', { list: { data: null, error: { message: 'list failed', details: 'secret' } } }],
    ['update', { update: { data: null, error: { message: 'update failed', details: 'secret' } } }],
  ] as const) {
    const fake = roleTableFake(results)
    const deps = createSupabaseDeps(fake.client as any, {})
    if (operation === 'get') await assertRoleStoreError(() => deps.getRole('user-id'))
    else if (operation === 'count') await assertRoleStoreError(() => deps.countOwners())
    else if (operation === 'list') await assertRoleStoreError(() => deps.listRoles(['user-id']))
    else await assertRoleStoreError(() => deps.updateRole('user-id', 'viewer', 'editor'))
  }
})

Deno.test('only the exact last-owner database conflict maps to LAST_OWNER_REQUIRED', async () => {
  const exactConflict = roleTableFake({
    update: { data: null, error: { code: 'P0001', message: 'LAST_OWNER_REQUIRED' } },
  })
  const exactDeps = createSupabaseDeps(exactConflict.client as any, {})
  const exactError = await assertRejects(
    () => exactDeps.updateRole('owner-id', 'admin', 'owner'),
    ApiError,
    'LAST_OWNER_REQUIRED',
  )
  assertEquals((exactError as ApiError).code, 'LAST_OWNER_REQUIRED')

  for (const error of [
    { code: 'P0001', message: 'a different constraint failed' },
    { code: '23505', message: 'LAST_OWNER_REQUIRED' },
  ]) {
    const fake = roleTableFake({ update: { data: null, error } })
    const deps = createSupabaseDeps(fake.client as any, {})
    await assertRoleStoreError(() => deps.updateRole('owner-id', 'admin', 'owner'))
  }
})

Deno.test('invalid roles returned by every role-table adapter fail closed', async () => {
  const getFake = roleTableFake({ get: { data: { role: 'superadmin' }, error: null } })
  await assertRoleStoreError(() => createSupabaseDeps(getFake.client as any, {}).getRole('user-id'))

  const listFake = roleTableFake({
    list: { data: [{ user_id: 'user-id', role: 'superadmin' }], error: null },
  })
  await assertRoleStoreError(() => createSupabaseDeps(listFake.client as any, {}).listRoles(['user-id']))

  const updateFake = roleTableFake({
    update: { data: { user_id: 'user-id', role: 'superadmin' }, error: null },
  })
  await assertRoleStoreError(() => createSupabaseDeps(updateFake.client as any, {}).updateRole('user-id', 'viewer', 'editor'))
})

Deno.test('updateRole treats a missing returned row as ROLE_STORE_ERROR', async () => {
  const fake = roleTableFake({ update: { data: null, error: null } })
  await assertRoleStoreError(() => createSupabaseDeps(fake.client as any, {}).updateRole('user-id', 'viewer', 'editor'))
})

Deno.test('updateRole rejects a missing, malformed, or mismatched returned user_id', async () => {
  for (const row of [
    { role: 'viewer' },
    { user_id: '', role: 'viewer' },
    { user_id: 42, role: 'viewer' },
    { user_id: 'different-id', role: 'viewer' },
  ]) {
    const fake = roleTableFake({ update: { data: row, error: null } })
    const deps = createSupabaseDeps(fake.client as any, {})
    await assertRoleStoreError(() => deps.updateRole('requested-id', 'viewer', 'editor'))
  }
})

Deno.test('role-table client failures map to stable ROLE_STORE_ERROR', async () => {
  const fake = roleTableFake({ fromError: new Error('client crashed with secret details') })
  const deps = createSupabaseDeps(fake.client as any, {})

  await assertRoleStoreError(() => deps.getRole('user-id'))
  await assertRoleStoreError(() => deps.listRoles(['user-id']))
  await assertRoleStoreError(() => deps.updateRole('user-id', 'viewer', 'editor'))
})
