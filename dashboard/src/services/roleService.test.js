import { describe, expect, it, vi } from 'vitest'
import { fetchStoredRole, parseStoredRole, RoleLookupError } from './roleService'

const buildRoleClient = (result) => {
  const maybeSingle = vi.fn().mockResolvedValue(result)
  const eq = vi.fn(() => ({ maybeSingle }))
  const select = vi.fn(() => ({ eq }))
  const from = vi.fn(() => ({ select }))

  return {
    client: { from },
    spies: { from, select, eq, maybeSingle },
  }
}

const expectLookupError = async (promise, code) => {
  await expect(promise).rejects.toMatchObject({
    name: 'RoleLookupError',
    code,
  })
}

describe('parseStoredRole', () => {
  it.each(['viewer', 'editor', 'admin', 'owner'])(
    'accepts the stored %s role',
    (role) => {
      expect(parseStoredRole(role)).toBe(role)
    },
  )

  it.each([null, undefined, '', ' Viewer', 'viewer ', 'OWNER', 'superadmin', 1, {}])(
    'rejects an invalid stored role value: %j',
    (role) => {
      expect(parseStoredRole(role)).toBeNull()
    },
  )
})

describe('RoleLookupError', () => {
  it('normalizes unsupported codes to a store error without retaining details', () => {
    const error = new RoleLookupError('UNSUPPORTED', new Error('database secret'))

    expect(error.code).toBe('ROLE_STORE_ERROR')
    expect(error.message).toBe('ROLE_STORE_ERROR')
    expect(error.cause).toBeUndefined()
  })
})

describe('fetchStoredRole', () => {
  it('queries the current user row with the exact read-only chain', async () => {
    const { client, spies } = buildRoleClient({ data: { role: 'owner' }, error: null })

    await expect(fetchStoredRole(client, 'user-123')).resolves.toBe('owner')
    expect(spies.from).toHaveBeenCalledOnce()
    expect(spies.from).toHaveBeenCalledWith('app_user_roles')
    expect(spies.select).toHaveBeenCalledOnce()
    expect(spies.select).toHaveBeenCalledWith('role')
    expect(spies.eq).toHaveBeenCalledOnce()
    expect(spies.eq).toHaveBeenCalledWith('user_id', 'user-123')
    expect(spies.maybeSingle).toHaveBeenCalledOnce()
    expect(spies.maybeSingle).toHaveBeenCalledWith()
  })

  it.each(['viewer', 'editor', 'admin', 'owner'])(
    'returns the %s role from the stored row',
    async (role) => {
      const { client } = buildRoleClient({ data: { role }, error: null })

      await expect(fetchStoredRole(client, 'user-123')).resolves.toBe(role)
    },
  )

  it.each([null, { role: null }, { role: '' }, { role: 'superadmin' }, {}])(
    'reports an unassigned role for a missing or invalid row: %j',
    async (data) => {
      const { client } = buildRoleClient({ data, error: null })

      await expectLookupError(fetchStoredRole(client, 'user-123'), 'ROLE_NOT_ASSIGNED')
    },
  )

  it('reports a store error without exposing Supabase error details', async () => {
    const { client } = buildRoleClient({
      data: null,
      error: { code: '42501', message: 'permission denied for app_user_roles' },
    })

    const promise = fetchStoredRole(client, 'user-123')
    await expectLookupError(promise, 'ROLE_STORE_ERROR')
    await expect(promise).rejects.not.toHaveProperty('cause')
    await expect(promise).rejects.not.toHaveProperty('details')
  })

  it.each([null, undefined, '', '   '])(
    'fails closed before querying for an invalid user id: %j',
    async (userId) => {
      const from = vi.fn()

      await expectLookupError(fetchStoredRole({ from }, userId), 'ROLE_STORE_ERROR')
      expect(from).not.toHaveBeenCalled()
    },
  )

  it.each([undefined, null, [], {}, { data: { role: 'viewer' } }, { error: null }])(
    'reports a store error for a malformed query boundary: %j',
    async (result) => {
      const { client } = buildRoleClient(result)

      await expectLookupError(fetchStoredRole(client, 'user-123'), 'ROLE_STORE_ERROR')
    },
  )

  it.each([['viewer'], [1], [[]]])(
    'reports a store error when row data has a malformed shape: %j',
    async (data) => {
      const { client } = buildRoleClient({ data, error: null })

      await expectLookupError(fetchStoredRole(client, 'user-123'), 'ROLE_STORE_ERROR')
    },
  )

  it('normalizes a synchronous query-chain exception', async () => {
    const client = {
      from: vi.fn(() => {
        throw new Error('synchronous database detail')
      }),
    }

    await expectLookupError(fetchStoredRole(client, 'user-123'), 'ROLE_STORE_ERROR')
  })

  it('normalizes an asynchronous query exception', async () => {
    const { client, spies } = buildRoleClient(null)
    spies.maybeSingle.mockRejectedValue(new Error('asynchronous database detail'))

    await expectLookupError(fetchStoredRole(client, 'user-123'), 'ROLE_STORE_ERROR')
  })
})
