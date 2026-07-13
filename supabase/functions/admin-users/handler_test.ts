import { assertEquals } from 'jsr:@std/assert'
import { createAdminUsersHandler, type HandlerDeps } from './handler.ts'

type Calls = Record<keyof HandlerDeps, number>

type FakeDeps = HandlerDeps & {
  actor: any
  users: any[]
  auditLogs: any[]
  calls: Calls
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

function fakeDeps({ actorRole = 'admin' }: { actorRole?: string } = {}): FakeDeps {
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
    async getActor() {
      calls.getActor++
      return deps.actor
    },
    async listUsers() {
      calls.listUsers++
      return deps.users
    },
    async inviteUser() {
      calls.inviteUser++
      return authUser('invited', 'invited@example.com', 'viewer')
    },
    async updateUser() {
      calls.updateUser++
      return authUser('updated', 'updated@example.com', 'viewer')
    },
    async deleteUser() {
      calls.deleteUser++
    },
    async resendInvite() {
      calls.resendInvite++
    },
    async sendPasswordReset() {
      calls.sendPasswordReset++
    },
    async insertAudit() {
      calls.insertAudit++
      return { id: 'audit-1' }
    },
    async completeAudit() {
      calls.completeAudit++
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
