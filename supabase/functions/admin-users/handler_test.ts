import { assertEquals } from 'jsr:@std/assert'
import { createAdminUsersHandler, type HandlerDeps } from './handler.ts'

type Calls = Record<keyof HandlerDeps, number>

type FakeDeps = HandlerDeps & {
  actor: any
  users: any[]
  auditLogs: any[]
  calls: Calls
  insertedAudits: Record<string, unknown>[]
  completedAudits: Array<{ id: string; status: 'success' | 'failure'; errorCode?: string }>
  inviteRequests: Array<{ email: string; role: string }>
}

type FakeOptions = {
  actorRole?: string
  updateError?: boolean
  inviteError?: boolean
  deleteError?: boolean
  resendError?: boolean
  resetError?: boolean
  insertAuditError?: boolean
  completeAuditError?: boolean
  completeAuditFailures?: number
}

function authUser(id: string, email: string, role: string) {
  return {
    id,
    email,
    app_metadata: { app_role: role },
    confirmed_at: '2026-07-14T00:00:00.000Z',
    created_at: '2026-07-14T00:00:00.000Z',
  }
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
  deleteError = false,
  resendError = false,
  resetError = false,
  insertAuditError = false,
  completeAuditError = false,
  completeAuditFailures = 0,
}: FakeOptions = {}): FakeDeps {
  let remainingCompletionFailures = completeAuditError ? Infinity : completeAuditFailures
  const calls: Calls = {
    getActor: 0,
    listUsers: 0,
    inviteUser: 0,
    updateUser: 0,
    deleteUser: 0,
    resendInvite: 0,
    sendPasswordReset: 0,
    insertAudit: 0,
    completeAudit: 0,
    listAuditLogs: 0,
  }
  const deps: FakeDeps = {
    actor: authUser('actor', 'actor@example.com', actorRole),
    users: [],
    auditLogs: [],
    calls,
    insertedAudits: [],
    completedAudits: [],
    inviteRequests: [],
    async getActor() {
      calls.getActor++
      return deps.actor
    },
    async listUsers() {
      calls.listUsers++
      return deps.users
    },
    async inviteUser(email, role) {
      calls.inviteUser++
      deps.inviteRequests.push({ email, role })
      if (inviteError) throw new Error('invite failed')
      return authUser('invited', email, role)
    },
    async updateUser(id, attributes) {
      calls.updateUser++
      if (updateError) throw new Error('update failed')
      return { ...authUser(id, 'updated@example.com', 'viewer'), ...attributes }
    },
    async deleteUser() {
      calls.deleteUser++
      if (deleteError) throw new Error('delete failed')
    },
    async resendInvite() {
      calls.resendInvite++
      if (resendError) throw new Error('resend failed')
    },
    async sendPasswordReset() {
      calls.sendPasswordReset++
      if (resetError) throw new Error('reset failed')
    },
    async insertAudit(row) {
      calls.insertAudit++
      if (insertAuditError) throw new Error('insert audit failed')
      deps.insertedAudits.push(row)
      return { id: 'audit-1' }
    },
    async completeAudit(id, status, errorCode) {
      calls.completeAudit++
      if (remainingCompletionFailures > 0) {
        remainingCompletionFailures--
        throw new Error('complete audit failed')
      }
      deps.completedAudits.push({ id, status, errorCode })
    },
    async listAuditLogs() {
      calls.listAuditLogs++
      return deps.auditLogs
    },
  }
  return deps
}

Deno.test('rejects a stale admin JWT when the fresh actor is editor', async () => {
  const deps = fakeDeps({ actorRole: 'editor' })
  const response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
  assertEquals(response.status, 403)
  assertEquals(deps.calls.listUsers, 0)
  assertEquals(deps.calls.insertAudit, 0)
})

Deno.test('lists only safe user fields for an admin', async () => {
  const deps = fakeDeps({ actorRole: 'admin' })
  deps.users = [authUser('u1', 'viewer@example.com', 'viewer')]
  const response = await createAdminUsersHandler(deps)(request({ action: 'list_users' }))
  const body: any = await response.json()
  assertEquals(response.status, 200)
  assertEquals(body.users[0], {
    id: 'u1', email: 'viewer@example.com', role: 'viewer', status: 'active',
    createdAt: '2026-07-14T00:00:00.000Z', lastSignInAt: null,
  })
  assertEquals('app_metadata' in body.users[0], false)
})

Deno.test('rejects a request without a bearer token', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
    method: 'POST', body: JSON.stringify({ action: 'list_users' }),
  }))
  assertEquals(response.status, 401)
  assertEquals(deps.calls.getActor, 0)
  assertEquals(deps.calls.insertAudit, 0)
})

Deno.test('rejects an empty bearer token before actor or user reads', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
    method: 'POST',
    headers: { Authorization: 'Bearer ', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list_users' }),
  }))
  assertEquals(response.status, 401)
  assertEquals(deps.calls.getActor, 0)
  assertEquals(deps.calls.listUsers, 0)
  assertEquals(deps.calls.insertAudit, 0)
})

Deno.test('rejects a whitespace-only bearer token before actor or user reads', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
    method: 'POST',
    headers: { Authorization: 'Bearer  ', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list_users' }),
  }))
  assertEquals(response.status, 401)
  assertEquals(deps.calls.getActor, 0)
  assertEquals(deps.calls.listUsers, 0)
  assertEquals(deps.calls.insertAudit, 0)
})

Deno.test('rejects malformed JSON', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: '{',
  }))
  assertEquals(response.status, 400)
})

Deno.test('rejects non-POST requests', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(new Request('http://localhost/admin-users', {
    headers: { Authorization: 'Bearer test-token' },
  }))
  assertEquals(response.status, 400)
  assertEquals(deps.calls.getActor, 0)
})

Deno.test('rejects unknown actions and fields', async () => {
  const deps = fakeDeps()
  for (const body of [
    { action: 'unknown' },
    { action: 'list_users', leaked: true },
  ]) {
    const response = await createAdminUsersHandler(deps)(request(body))
    assertEquals(response.status, 400)
  }
  assertEquals(deps.calls.listUsers, 0)
})

Deno.test('returns only adapter-shaped audit log snapshots', async () => {
  const deps = fakeDeps()
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

Deno.test('invite assigns its role atomically without update or rollback', async () => {
  const deps = fakeDeps({ actorRole: 'admin', updateError: true })
  const response = await createAdminUsersHandler(deps)(request({
    action: 'invite_user', email: 'new@example.com', role: 'editor',
  }))
  const body: any = await response.json()
  assertEquals(response.status, 200)
  assertEquals(deps.inviteRequests, [{ email: 'new@example.com', role: 'editor' }])
  assertEquals(deps.calls.updateUser, 0)
  assertEquals(deps.calls.deleteUser, 0)
  assertEquals(body.user.role, 'editor')
})

Deno.test('invite uses viewer role when omitted', async () => {
  const deps = fakeDeps()
  const response = await createAdminUsersHandler(deps)(request({
    action: 'invite_user', email: 'new@example.com',
  }))
  const body: any = await response.json()
  assertEquals(response.status, 200)
  assertEquals(body.user.role, 'viewer')
})

Deno.test('invite rejects invalid roles and duplicate emails before Auth mutation', async () => {
  const invalid = fakeDeps()
  let response = await createAdminUsersHandler(invalid)(request({
    action: 'invite_user', email: 'new@example.com', role: 'owner',
  }))
  assertEquals(response.status, 400)
  assertEquals(invalid.calls.insertAudit, 0)

  const duplicate = fakeDeps()
  duplicate.users = [authUser('existing', 'new@example.com', 'viewer')]
  response = await createAdminUsersHandler(duplicate)(request({
    action: 'invite_user', email: ' NEW@example.com ', role: 'viewer',
  }))
  assertEquals(response.status, 409)
  assertEquals(duplicate.calls.inviteUser, 0)
  assertEquals(duplicate.completedAudits.at(-1)?.errorCode, 'USER_EXISTS')
})

Deno.test('allows changing another admin while two admins remain', async () => {
  const deps = fakeDeps({ actorRole: 'admin' })
  deps.users = [authUser('actor', 'actor@example.com', 'admin'), authUser('last', 'last@example.com', 'admin')]
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'last', role: 'viewer',
  }))
  assertEquals(response.status, 200)
})

Deno.test('failed role updates complete their pending audit with the fixed Auth error code', async () => {
  const deps = fakeDeps({ updateError: true })
  deps.users = [authUser('target', 'target@example.com', 'viewer')]
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'target', role: 'editor',
  }))
  assertEquals(response.status, 502)
  assertEquals(deps.completedAudits.at(-1), {
    id: 'audit-1', status: 'failure', errorCode: 'SUPABASE_AUTH_ERROR',
  })
})

Deno.test('a concurrent last-admin database rejection is surfaced safely after the early guard', async () => {
  const deps = fakeDeps({ updateError: true })
  deps.users = [authUser('actor', 'actor@example.com', 'admin'), authUser('target', 'target@example.com', 'admin')]
  const response = await createAdminUsersHandler(deps)(request({
    action: 'update_role', userId: 'target', role: 'viewer',
  }))
  assertEquals(response.status, 502)
  assertEquals(deps.completedAudits.at(-1), {
    id: 'audit-1', status: 'failure', errorCode: 'SUPABASE_AUTH_ERROR',
  })
})

Deno.test('rejects self role and delete mutations and audits both attempts', async () => {
  const deps = fakeDeps({ actorRole: 'admin' })
  deps.users = [authUser('actor', 'actor@example.com', 'admin')]
  for (const body of [
    { action: 'update_role', userId: 'actor', role: 'viewer' },
    { action: 'delete_user', userId: 'actor', confirmEmail: 'actor@example.com' },
  ]) {
    const response = await createAdminUsersHandler(deps)(request(body))
    assertEquals(response.status, 409)
    assertEquals(deps.completedAudits.at(-1)?.status, 'failure')
    assertEquals(deps.completedAudits.at(-1)?.errorCode, 'SELF_MUTATION_FORBIDDEN')
  }
})

Deno.test('update role rejects unknown user and preserves the last admin', async () => {
  const unknown = fakeDeps()
  let response = await createAdminUsersHandler(unknown)(request({
    action: 'update_role', userId: 'missing', role: 'viewer',
  }))
  assertEquals(response.status, 404)
  assertEquals(unknown.calls.insertAudit, 0)

  const lastAdmin = fakeDeps()
  lastAdmin.users = [authUser('actor', 'actor@example.com', 'admin'), authUser('last', 'last@example.com', 'admin')]
  lastAdmin.users.shift()
  lastAdmin.actor = authUser('actor', 'actor@example.com', 'admin')
  response = await createAdminUsersHandler(lastAdmin)(request({
    action: 'update_role', userId: 'last', role: 'viewer',
  }))
  assertEquals(response.status, 409)
  assertEquals(lastAdmin.completedAudits.at(-1)?.errorCode, 'LAST_ADMIN_PROTECTED')
})

Deno.test('delete requires exact normalized email and preserves audit snapshot', async () => {
  const deps = fakeDeps({ actorRole: 'admin' })
  deps.users = [
    authUser('actor', 'actor@example.com', 'admin'),
    authUser('other-admin', 'other@example.com', 'admin'),
    authUser('target', 'target@example.com', 'editor'),
  ]
  const response = await createAdminUsersHandler(deps)(request({
    action: 'delete_user', userId: 'target', confirmEmail: ' TARGET@example.com ',
  }))
  assertEquals(response.status, 200)
  assertEquals(deps.insertedAudits.at(-1)?.target_email, 'target@example.com')
  assertEquals(deps.completedAudits.at(-1)?.status, 'success')
})

Deno.test('delete rejects mismatched emails and records failed deletion', async () => {
  const mismatch = fakeDeps()
  mismatch.users = [authUser('target', 'target@example.com', 'viewer')]
  let response = await createAdminUsersHandler(mismatch)(request({
    action: 'delete_user', userId: 'target', confirmEmail: 'wrong@example.com',
  }))
  assertEquals(response.status, 400)
  assertEquals(mismatch.completedAudits.at(-1)?.errorCode, 'EMAIL_CONFIRMATION_MISMATCH')

  const failed = fakeDeps({ deleteError: true })
  failed.users = [authUser('target', 'target@example.com', 'viewer')]
  response = await createAdminUsersHandler(failed)(request({
    action: 'delete_user', userId: 'target', confirmEmail: 'target@example.com',
  }))
  assertEquals(response.status, 502)
  assertEquals(failed.completedAudits.at(-1)?.status, 'failure')
  assertEquals(failed.completedAudits.at(-1)?.errorCode, 'SUPABASE_AUTH_ERROR')
})

Deno.test('resends invites and sends password resets with completed audits', async () => {
  const deps = fakeDeps()
  deps.users = [authUser('target', 'target@example.com', 'viewer')]
  for (const action of ['resend_invite', 'send_password_reset']) {
    const response = await createAdminUsersHandler(deps)(request({ action, userId: 'target' }))
    assertEquals(response.status, 200)
    assertEquals(deps.completedAudits.at(-1)?.status, 'success')
  }
  assertEquals(deps.calls.resendInvite, 1)
  assertEquals(deps.calls.sendPasswordReset, 1)
})

Deno.test('failed resend and password reset attempts complete their pending audits', async () => {
  for (const [action, options] of [
    ['resend_invite', { resendError: true }],
    ['send_password_reset', { resetError: true }],
  ] as const) {
    const deps = fakeDeps(options)
    deps.users = [authUser('target', 'target@example.com', 'viewer')]
    const response = await createAdminUsersHandler(deps)(request({ action, userId: 'target' }))
    assertEquals(response.status, 502)
    assertEquals(deps.completedAudits.at(-1), {
      id: 'audit-1', status: 'failure', errorCode: 'SUPABASE_AUTH_ERROR',
    })
  }
})

Deno.test('audit insertion failures hide underlying errors and prevent Auth mutation', async () => {
  const insertFailure = fakeDeps({ insertAuditError: true })
  insertFailure.users = [authUser('target', 'target@example.com', 'viewer')]
  let response = await createAdminUsersHandler(insertFailure)(request({
    action: 'resend_invite', userId: 'target',
  }))
  assertEquals(response.status, 500)
  assertEquals(insertFailure.calls.resendInvite, 0)
})

Deno.test('a successful mutation leaves its audit pending when completion transiently fails', async () => {
  const completionFailure = fakeDeps({ completeAuditFailures: 1 })
  completionFailure.users = [authUser('target', 'target@example.com', 'viewer')]
  const response = await createAdminUsersHandler(completionFailure)(request({
    action: 'send_password_reset', userId: 'target',
  }))
  assertEquals(response.status, 500)
  assertEquals(completionFailure.calls.sendPasswordReset, 1)
  assertEquals(completionFailure.calls.completeAudit, 1)
  assertEquals(completionFailure.completedAudits.length, 0)
})
