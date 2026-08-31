import { assertEquals } from 'jsr:@std/assert'
import {
  createAdminUsersHandler,
  type AuthUser,
  type HandlerDeps,
  type RoleRecord,
} from './handler.ts'
import type { AccountMutationAction, AppRole, AssignableRole } from './domain.ts'

type RecordedCall = { name: keyof HandlerDeps; args: unknown[] }

type FakeDeps = HandlerDeps & {
  actor: AuthUser | null
  users: AuthUser[]
  roles: Map<string, AppRole>
  auditLogs: Record<string, unknown>[]
  calls: RecordedCall[]
  insertedAudits: Record<string, unknown>[]
  completedAudits: Array<{ id: string; status: 'success' | 'failure'; errorCode?: string }>
}

type FakeOptions = {
  actorRole?: AppRole | null
  updateError?: boolean
  inviteError?: boolean
  inviteRole?: AppRole | null
  deleteError?: boolean
  resendError?: boolean
  resetError?: boolean
  insertAuditError?: boolean
  completeAuditFailures?: number
}

function authUser(id: string, email: string, metadataRole: string): AuthUser {
  return {
    id,
    email,
    app_metadata: { app_role: metadataRole },
    user_metadata: { app_role: metadataRole },
    confirmed_at: '2026-07-14T00:00:00.000Z',
    created_at: '2026-07-14T00:00:00.000Z',
  }
}

function signedInUser(id: string, email: string, metadataRole: string): AuthUser {
  return { ...authUser(id, email, metadataRole), last_sign_in_at: '2026-07-14T00:00:00.000Z' }
}

function request(body: unknown) {
  return new Request('http://localhost/admin-users', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer test-token',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function fakeDeps({
  actorRole = 'admin',
  updateError = false,
  inviteError = false,
  inviteRole = 'viewer',
  deleteError = false,
  resendError = false,
  resetError = false,
  insertAuditError = false,
  completeAuditFailures = 0,
}: FakeOptions = {}): FakeDeps {
  let remainingCompletionFailures = completeAuditFailures
  const calls: RecordedCall[] = []
  const actorMetadataRole = actorRole === 'owner' ? 'viewer' : 'owner'
  const deps: FakeDeps = {
    actor: signedInUser('actor', 'actor@example.com', actorMetadataRole),
    users: [] as AuthUser[],
    roles: new Map<string, AppRole>(),
    auditLogs: [] as Record<string, unknown>[],
    calls,
    insertedAudits: [] as Record<string, unknown>[],
    completedAudits: [] as Array<{
      id: string
      status: 'success' | 'failure'
      errorCode?: string
    }>,
    async getActor(token: string) {
      calls.push({ name: 'getActor', args: [token] })
      return deps.actor
    },
    async getRole(userId: string) {
      calls.push({ name: 'getRole', args: [userId] })
      return deps.roles.get(userId) ?? null
    },
    async listUsers() {
      calls.push({ name: 'listUsers', args: [] })
      return deps.users
    },
    async listRoles(userIds: string[]) {
      calls.push({ name: 'listRoles', args: [userIds] })
      return userIds.flatMap(userId => {
        const role = deps.roles.get(userId)
        return role ? [{ userId, role }] : []
      })
    },
    async inviteUser(email: string) {
      calls.push({ name: 'inviteUser', args: [email] })
      if (inviteError) throw new Error('invite failed')
      const invited = authUser('invited', email, 'owner')
      deps.users.push(invited)
      if (inviteRole) deps.roles.set(invited.id, inviteRole)
      return invited
    },
    async updateRole(userId: string, role: AssignableRole): Promise<RoleRecord> {
      calls.push({ name: 'updateRole', args: [userId, role] })
      if (updateError) throw new Error('update failed')
      deps.roles.set(userId, role)
      return { userId, role }
    },
    async deleteUser(userId: string) {
      calls.push({ name: 'deleteUser', args: [userId] })
      if (deleteError) throw new Error('delete failed')
      deps.users = deps.users.filter(user => user.id !== userId)
      deps.roles.delete(userId)
    },
    async resendInvite(email: string) {
      calls.push({ name: 'resendInvite', args: [email] })
      if (resendError) throw new Error('resend failed')
    },
    async sendPasswordReset(email: string) {
      calls.push({ name: 'sendPasswordReset', args: [email] })
      if (resetError) throw new Error('reset failed')
    },
    async insertAudit(row: Record<string, unknown>) {
      calls.push({ name: 'insertAudit', args: [row] })
      if (insertAuditError) throw new Error('insert audit failed')
      deps.insertedAudits.push(row)
      return { id: `audit-${deps.insertedAudits.length}` }
    },
    async completeAudit(id: string, status: 'success' | 'failure', errorCode?: string) {
      calls.push({ name: 'completeAudit', args: [id, status, errorCode] })
      if (remainingCompletionFailures > 0) {
        remainingCompletionFailures--
        throw new Error('complete audit failed')
      }
      deps.completedAudits.push({ id, status, errorCode })
    },
    async listAuditLogs() {
      calls.push({ name: 'listAuditLogs', args: [] })
      return deps.auditLogs
    },
  }

  if (actorRole && deps.actor) deps.roles.set(deps.actor.id, actorRole)
  return deps
}

function callsNamed(deps: FakeDeps, name: keyof HandlerDeps) {
  return deps.calls.filter(call => call.name === name)
}

function addTarget(deps: FakeDeps, id: string, role: AppRole | null) {
  deps.users.push(signedInUser(id, `${id}@example.com`, role === 'owner' ? 'viewer' : 'owner'))
  if (role) deps.roles.set(id, role)
}

function mutationBody(action: AccountMutationAction, targetId: string, targetRole: AppRole | null) {
  switch (action) {
    case 'update_role':
      return {
        action,
        userId: targetId,
        role: targetRole === 'viewer' ? 'editor' : 'viewer',
      }
    case 'delete_user':
      return { action, userId: targetId, confirmEmail: `${targetId}@example.com` }
    default:
      return { action, userId: targetId }
  }
}

const mutationActions: readonly AccountMutationAction[] = [
  'update_role',
  'delete_user',
  'resend_invite',
  'send_password_reset',
]

function assertDeniedMutationHasNoSideEffects(
  deps: FakeDeps,
  action: AccountMutationAction,
  targetId: string,
  storedRole: AppRole | null,
) {
  const mutationName: keyof HandlerDeps = action === 'update_role'
    ? 'updateRole'
    : action === 'delete_user'
    ? 'deleteUser'
    : action === 'resend_invite'
    ? 'resendInvite'
    : 'sendPasswordReset'
  assertEquals(callsNamed(deps, mutationName).length, 0)
  assertEquals(deps.users.some(user => user.id === targetId), true)
  if (storedRole) assertEquals(deps.roles.get(targetId), storedRole)
  else assertEquals(deps.roles.has(targetId), false)
}

Deno.test('loads every actor role from the store and ignores conflicting Auth metadata', async () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    const deps = fakeDeps({ actorRole })
    const response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
    assertEquals(response.status, 200)
    assertEquals(callsNamed(deps, 'getRole')[0]?.args, ['actor'])
  }

  for (const actorRole of ['viewer', 'editor'] as const) {
    const deps = fakeDeps({ actorRole })
    const response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
    const body: any = await response.json()
    assertEquals(response.status, 403)
    assertEquals(body.error.code, 'FORBIDDEN')
    assertEquals(callsNamed(deps, 'listUsers').length, 0)
  }
})

Deno.test('fails closed when actor identity or stored role is missing or invalid', async () => {
  const missingActor = fakeDeps()
  missingActor.actor = null
  let response = await createAdminUsersHandler(missingActor)(request({ action: 'list_users' }))
  assertEquals(response.status, 401)
  assertEquals((await response.json() as any).error.code, 'UNAUTHENTICATED')
  assertEquals(callsNamed(missingActor, 'getRole').length, 0)

  for (const role of [null, 'invalid'] as const) {
    const deps = fakeDeps({ actorRole: null })
    if (role) deps.roles.set('actor', role as AppRole)
    response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
    assertEquals(response.status, 403)
    assertEquals((await response.json() as any).error.code, 'ROLE_NOT_ASSIGNED')
    assertEquals(callsNamed(deps, 'listUsers').length, 0)
  }
})

Deno.test('lists safe Auth identity fields with one batched stored-role read', async () => {
  const deps = fakeDeps({ actorRole: 'admin' })
  deps.users = [
    authUser('viewer-id', 'viewer@example.com', 'owner'),
    authUser('orphan-id', 'orphan@example.com', 'admin'),
  ]
  deps.roles.set('viewer-id', 'viewer')

  const response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
  const body: any = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.users, [
    {
      id: 'viewer-id', email: 'viewer@example.com', role: 'viewer', status: 'active',
      createdAt: '2026-07-14T00:00:00.000Z', lastSignInAt: null,
    },
    {
      id: 'orphan-id', email: 'orphan@example.com', role: null, status: 'active',
      createdAt: '2026-07-14T00:00:00.000Z', lastSignInAt: null,
    },
  ])
  assertEquals(callsNamed(deps, 'listRoles').map(call => call.args), [
    [['viewer-id', 'orphan-id']],
  ])
  assertEquals(callsNamed(deps, 'getRole').map(call => call.args), [['actor']])
  assertEquals('app_metadata' in body.users[0], false)
  assertEquals('user_metadata' in body.users[0], false)
})

Deno.test('returns only adapter-shaped audit log snapshots after stored-role authorization', async () => {
  const deps = fakeDeps({ actorRole: 'owner' })
  deps.auditLogs = [{
    id: 'audit-1',
    actorEmail: 'actor@example.com',
    action: 'invite_user',
    targetEmail: 'viewer@example.com',
    oldRole: null,
    newRole: 'viewer',
    status: 'success',
    errorCode: null,
    createdAt: '2026-07-14T00:00:00.000Z',
    completedAt: '2026-07-14T00:01:00.000Z',
  }]

  const response = await createAdminUsersHandler(deps)(request({ action: 'list_audit_logs' }))
  const body: any = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.auditLogs, deps.auditLogs)
  assertEquals('actor_user_id' in body.auditLogs[0], false)
})

Deno.test('invite ignores supplied role and reads the trigger-created stored role', async () => {
  const deps = fakeDeps({ actorRole: 'admin', inviteRole: 'viewer' })
  const response = await createAdminUsersHandler(deps)(request({
    action: 'invite_user', email: ' NEW@example.com ', role: 'admin',
  }))
  const body: any = await response.json()

  assertEquals(response.status, 200)
  assertEquals(body.user, {
    id: 'invited', email: 'new@example.com', role: 'viewer', status: 'active',
    createdAt: '2026-07-14T00:00:00.000Z', lastSignInAt: null,
  })
  assertEquals(callsNamed(deps, 'inviteUser').map(call => call.args), [['new@example.com']])
  assertEquals(callsNamed(deps, 'getRole').map(call => call.args), [['actor'], ['invited']])
  assertEquals(deps.insertedAudits[0]?.actor_role, 'admin')
  assertEquals(deps.insertedAudits[0]?.new_role, 'viewer')
  assertEquals(deps.completedAudits[0]?.status, 'success')
})

Deno.test('invite fails closed when the trigger-created stored role is missing', async () => {
  const deps = fakeDeps({ inviteRole: null })
  const response = await createAdminUsersHandler(deps)(request({
    action: 'invite_user', email: 'new@example.com',
  }))
  const body: any = await response.json()

  assertEquals(response.status, 403)
  assertEquals(body.error.code, 'ROLE_NOT_ASSIGNED')
  assertEquals(callsNamed(deps, 'inviteUser').length, 1)
  assertEquals(deps.completedAudits[0], {
    id: 'audit-1', status: 'failure', errorCode: 'ROLE_NOT_ASSIGNED',
  })
})

Deno.test('invite audits duplicate and provider failures without a role metadata write', async () => {
  const duplicate = fakeDeps()
  duplicate.users = [authUser('existing', 'new@example.com', 'owner')]
  duplicate.roles.set('existing', 'viewer')
  let response = await createAdminUsersHandler(duplicate)(request({
    action: 'invite_user', email: ' NEW@example.com ', role: 'owner',
  }))
  assertEquals(response.status, 409)
  assertEquals((await response.json() as any).error.code, 'USER_EXISTS')
  assertEquals(callsNamed(duplicate, 'inviteUser').length, 0)
  assertEquals(duplicate.completedAudits[0]?.errorCode, 'USER_EXISTS')

  const failed = fakeDeps({ inviteError: true })
  response = await createAdminUsersHandler(failed)(request({
    action: 'invite_user', email: 'new@example.com',
  }))
  assertEquals(response.status, 502)
  assertEquals((await response.json() as any).error.code, 'SUPABASE_AUTH_ERROR')
  assertEquals(failed.completedAudits[0]?.errorCode, 'SUPABASE_AUTH_ERROR')
})

Deno.test('owners and admins cannot mutate themselves and every denial is audited', async () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    for (const action of mutationActions) {
      const deps = fakeDeps({ actorRole })
      deps.users = [deps.actor!]
      const response = await createAdminUsersHandler(deps)(
        request(mutationBody(action, 'actor', actorRole)),
      )
      const body: any = await response.json()

      assertEquals(response.status, 409)
      assertEquals(body.error.code, 'SELF_MUTATION_FORBIDDEN')
      assertEquals(deps.insertedAudits[0]?.actor_role, actorRole)
      assertEquals(deps.insertedAudits[0]?.old_role, actorRole)
      assertEquals(deps.completedAudits[0]?.errorCode, 'SELF_MUTATION_FORBIDDEN')
      const mutationName = action === 'update_role' ? 'updateRole'
        : action === 'delete_user' ? 'deleteUser'
        : action === 'resend_invite' ? 'resendInvite'
        : 'sendPasswordReset'
      assertEquals(callsNamed(deps, mutationName).length, 0)
    }
  }
})

Deno.test('owner targets are protected from admin actors with stored-role audits', async () => {
  for (const action of mutationActions) {
    const deps = fakeDeps({ actorRole: 'admin' })
    addTarget(deps, 'owner-target', 'owner')
    const response = await createAdminUsersHandler(deps)(
      request(mutationBody(action, 'owner-target', 'owner')),
    )

    assertEquals(response.status, 409)
    assertEquals((await response.json() as any).error.code, 'OWNER_PROTECTED')
    assertEquals(deps.insertedAudits[0]?.old_role, 'owner')
    assertEquals(deps.completedAudits[0]?.errorCode, 'OWNER_PROTECTED')
    assertDeniedMutationHasNoSideEffects(deps, action, 'owner-target', 'owner')
  }
})

Deno.test('owner can perform every mutation against another owner', async () => {
  for (const action of mutationActions) {
    const deps = fakeDeps({ actorRole: 'owner' })
    addTarget(deps, 'owner-target', 'owner')
    const response = await createAdminUsersHandler(deps)(
      request(mutationBody(action, 'owner-target', 'owner')),
    )

    assertEquals(response.status, 200)
    assertEquals(deps.insertedAudits[0]?.actor_role, 'owner')
    assertEquals(deps.insertedAudits[0]?.old_role, 'owner')
    assertEquals(deps.completedAudits[0]?.status, 'success')
  }
})

Deno.test('ordinary admins receive stable errors for every peer-admin mutation', async () => {
  for (const action of mutationActions) {
    const deps = fakeDeps({ actorRole: 'admin' })
    addTarget(deps, 'peer-admin', 'admin')
    const response = await createAdminUsersHandler(deps)(
      request(mutationBody(action, 'peer-admin', 'admin')),
    )
    const body: any = await response.json()
    const expectedCode = action === 'update_role' || action === 'delete_user'
      ? 'OWNER_REQUIRED'
      : 'ADMIN_TARGET_FORBIDDEN'

    assertEquals(response.status, 403)
    assertEquals(body.error.code, expectedCode)
    assertEquals(deps.completedAudits[0]?.errorCode, expectedCode)
    assertDeniedMutationHasNoSideEffects(deps, action, 'peer-admin', 'admin')
  }
})

Deno.test('owner can perform every mutation against an ordinary admin', async () => {
  for (const action of mutationActions) {
    const deps = fakeDeps({ actorRole: 'owner' })
    addTarget(deps, 'admin-target', 'admin')
    const response = await createAdminUsersHandler(deps)(
      request(mutationBody(action, 'admin-target', 'admin')),
    )

    assertEquals(response.status, 200)
    assertEquals(deps.insertedAudits[0]?.actor_role, 'owner')
    assertEquals(deps.insertedAudits[0]?.old_role, 'admin')
    assertEquals(deps.completedAudits[0]?.status, 'success')
  }
})

Deno.test('owner and admin can perform every permitted viewer/editor mutation', async () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    for (const targetRole of ['viewer', 'editor'] as const) {
      for (const action of mutationActions) {
        const deps = fakeDeps({ actorRole })
        addTarget(deps, `${targetRole}-target`, targetRole)
        const response = await createAdminUsersHandler(deps)(
          request(mutationBody(action, `${targetRole}-target`, targetRole)),
        )

        assertEquals(response.status, 200)
        assertEquals(deps.insertedAudits[0]?.actor_role, actorRole)
        assertEquals(deps.insertedAudits[0]?.old_role, targetRole)
        assertEquals(deps.completedAudits[0]?.status, 'success')
      }
    }
  }
})

Deno.test('every target mutation fails closed and audits a missing stored target role', async () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    for (const action of mutationActions) {
      const deps = fakeDeps({ actorRole })
      addTarget(deps, 'orphan-target', null)
      const response = await createAdminUsersHandler(deps)(
        request(mutationBody(action, 'orphan-target', null)),
      )

      assertEquals(response.status, 403)
      assertEquals((await response.json() as any).error.code, 'ROLE_NOT_ASSIGNED')
      assertEquals(deps.insertedAudits[0]?.old_role, null)
      assertEquals(deps.completedAudits[0]?.errorCode, 'ROLE_NOT_ASSIGNED')
      assertDeniedMutationHasNoSideEffects(deps, action, 'orphan-target', null)
    }
  }
})

Deno.test('admin cannot assign admin or owner while owner can assign both', async () => {
  for (const targetAssignRole of ['admin', 'owner'] as const) {
    for (const actorRole of ['admin', 'owner'] as const) {
      const deps = fakeDeps({ actorRole })
      addTarget(deps, 'viewer-target', 'viewer')
      const response = await createAdminUsersHandler(deps)(request({
        action: 'update_role', userId: 'viewer-target', role: targetAssignRole,
      }))

      assertEquals(response.status, actorRole === 'owner' ? 200 : 403)
      assertEquals(
        actorRole === 'owner' ? deps.roles.get('viewer-target') : (await response.json() as any).error.code,
        actorRole === 'owner' ? targetAssignRole : 'OWNER_REQUIRED',
      )
    }
  }

  const invalid = fakeDeps({ actorRole: 'owner' })
  addTarget(invalid, 'viewer-target', 'viewer')
  const response = await createAdminUsersHandler(invalid)(request({
    action: 'update_role', userId: 'viewer-target', role: 'invalid_role',
  }))
  assertEquals(response.status, 400)
  assertEquals((await response.json() as any).error.code, 'INVALID_INPUT')
  assertEquals(callsNamed(invalid, 'updateRole').length, 0)
})

Deno.test('update role uses only the role store and summarizes the unchanged Auth identity', async () => {
  const deps = fakeDeps({ actorRole: 'owner' })
  addTarget(deps, 'admin-target', 'admin')
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'admin-target', role: 'editor',
  }))
  const body: any = await response.json()

  assertEquals(response.status, 200)
  assertEquals(callsNamed(deps, 'updateRole').map(call => call.args), [['admin-target', 'editor']])
  assertEquals(body.user.email, 'admin-target@example.com')
  assertEquals(body.user.role, 'editor')
  assertEquals(body.requiresRelogin, true)
  assertEquals(deps.insertedAudits[0]?.old_role, 'admin')
  assertEquals(deps.insertedAudits[0]?.new_role, 'editor')
  const methodOrder = deps.calls.map(call => call.name)
  assertEquals(
    methodOrder.indexOf('insertAudit') < methodOrder.indexOf('updateRole') &&
      methodOrder.indexOf('updateRole') < methodOrder.indexOf('completeAudit'),
    true,
  )
})

Deno.test('role updates still require the invited user to sign in first', async () => {
  const deps = fakeDeps({ actorRole: 'owner' })
  deps.users.push(authUser('invited-target', 'invited-target@example.com', 'owner'))
  deps.roles.set('invited-target', 'viewer')
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'invited-target', role: 'editor',
  }))

  assertEquals(response.status, 409)
  assertEquals((await response.json() as any).error.code, 'FIRST_LOGIN_REQUIRED')
  assertEquals(callsNamed(deps, 'updateRole').length, 0)
  assertEquals(deps.completedAudits[0], {
    id: 'audit-1', status: 'failure', errorCode: 'FIRST_LOGIN_REQUIRED',
  })
})

Deno.test('role update success survives audit completion failure and appears on the next list', async () => {
  const deps = fakeDeps({ actorRole: 'owner', completeAuditFailures: 1 })
  addTarget(deps, 'admin-target', 'admin')
  let response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'admin-target', role: 'editor',
  }))

  assertEquals(response.status, 500)
  assertEquals((await response.json() as any).error.code, 'AUDIT_WRITE_ERROR')
  assertEquals(deps.roles.get('admin-target'), 'editor')
  assertEquals(callsNamed(deps, 'updateRole').length, 1)
  assertEquals(deps.completedAudits.length, 0)

  response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
  const body: any = await response.json()
  assertEquals(response.status, 200)
  assertEquals(body.users.find((user: any) => user.id === 'admin-target')?.role, 'editor')
  assertEquals(callsNamed(deps, 'updateRole').length, 1)
})

Deno.test('denied and failed mutations complete pending audits with stable error codes', async () => {
  const denied = fakeDeps({ actorRole: 'admin' })
  addTarget(denied, 'peer-admin', 'admin')
  let response = await createAdminUsersHandler(denied)(request({
    action: 'delete_user', userId: 'peer-admin', confirmEmail: 'peer-admin@example.com',
  }))
  assertEquals(response.status, 403)
  assertEquals(denied.insertedAudits[0]?.status, 'pending')
  assertEquals(denied.completedAudits[0], {
    id: 'audit-1', status: 'failure', errorCode: 'OWNER_REQUIRED',
  })

  for (const [action, options] of [
    ['update_role', { updateError: true }],
    ['delete_user', { deleteError: true }],
    ['resend_invite', { resendError: true }],
    ['send_password_reset', { resetError: true }],
  ] as const) {
    const failed = fakeDeps({ actorRole: 'owner', ...options })
    addTarget(failed, 'target', 'viewer')
    response = await createAdminUsersHandler(failed)(
      request(mutationBody(action, 'target', 'viewer')),
    )
    assertEquals(response.status, 502)
    assertEquals(failed.insertedAudits[0]?.status, 'pending')
    assertEquals(failed.completedAudits[0], {
      id: 'audit-1', status: 'failure', errorCode: 'SUPABASE_AUTH_ERROR',
    })
  }
})

Deno.test('email confirmation mismatch is audited before delete and blocks deletion', async () => {
  const deps = fakeDeps({ actorRole: 'owner' })
  addTarget(deps, 'target', 'viewer')
  const response = await createAdminUsersHandler(deps)(request({
    action: 'delete_user', userId: 'target', confirmEmail: 'wrong@example.com',
  }))

  assertEquals(response.status, 400)
  assertEquals((await response.json() as any).error.code, 'EMAIL_CONFIRMATION_MISMATCH')
  assertEquals(callsNamed(deps, 'deleteUser').length, 0)
  assertEquals(deps.completedAudits[0]?.errorCode, 'EMAIL_CONFIRMATION_MISMATCH')
})

Deno.test('unknown target fails before role lookup or audit insertion', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'missing', role: 'viewer',
  }))

  assertEquals(response.status, 404)
  assertEquals((await response.json() as any).error.code, 'USER_NOT_FOUND')
  assertEquals(callsNamed(deps, 'getRole').map(call => call.args), [['actor']])
  assertEquals(callsNamed(deps, 'insertAudit').length, 0)
})

Deno.test('pending audit insertion failure prevents every external mutation', async () => {
  const deps = fakeDeps({ actorRole: 'owner', insertAuditError: true })
  addTarget(deps, 'target', 'viewer')
  const response = await createAdminUsersHandler(deps)(request({
    action: 'resend_invite', userId: 'target',
  }))

  assertEquals(response.status, 500)
  assertEquals((await response.json() as any).error.code, 'AUDIT_WRITE_ERROR')
  assertEquals(callsNamed(deps, 'resendInvite').length, 0)
})

Deno.test('request validation preserves bearer, method, JSON and action boundaries', async () => {
  const noBearer = fakeDeps()
  let response = await createAdminUsersHandler(noBearer)(new Request(
    'http://localhost/admin-users',
    { method: 'POST', body: JSON.stringify({ action: 'list_users' }) },
  ))
  assertEquals(response.status, 401)
  assertEquals(callsNamed(noBearer, 'getActor').length, 0)

  for (const authorization of ['Bearer ', 'Bearer  ']) {
    const deps = fakeDeps()
    response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_users' }),
    }))
    assertEquals(response.status, 401)
    assertEquals(callsNamed(deps, 'getActor').length, 0)
  }

  const malformed = fakeDeps()
  response = await createAdminUsersHandler(malformed)(new Request('http://localhost/admin-users', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: '{',
  }))
  assertEquals(response.status, 400)
  assertEquals(callsNamed(malformed, 'getRole').map(call => call.args), [['actor']])

  const nonPost = fakeDeps()
  response = await createAdminUsersHandler(nonPost)(new Request('http://localhost/admin-users', {
    headers: { Authorization: 'Bearer test-token' },
  }))
  assertEquals(response.status, 400)
  assertEquals(callsNamed(nonPost, 'getActor').length, 0)

  for (const body of [{ action: 'unknown' }, { action: 'list_users', leaked: true }]) {
    const deps = fakeDeps()
    response = await createAdminUsersHandler(deps)(request(body))
    assertEquals(response.status, 400)
    assertEquals(callsNamed(deps, 'listUsers').length, 0)
  }
})
