import { assertEquals, assertRejects } from 'jsr:@std/assert'
import {
  ApiError,
  assertActionBody,
  assertAdminActor,
  assertTargetMutationAllowed,
  normalizeRole,
} from './domain.ts'

Deno.test('invalid role fails closed to viewer', () => {
  assertEquals(normalizeRole('owner'), 'viewer')
  assertEquals(normalizeRole(undefined), 'viewer')
})

Deno.test('action bodies reject unknown actions and fields', () => {
  for (const body of [
    { action: 'unknown' },
    { action: 'list_users', leaked: true },
    { action: 'resend_invite', userId: 'u1', email: 'untrusted@example.com' },
  ]) {
    let code = ''
    try { assertActionBody(body) } catch (error) { code = (error as ApiError).code }
    assertEquals(code, 'INVALID_INPUT')
  }
})

Deno.test('only a fresh admin actor is accepted', () => {
  assertAdminActor({ id: 'actor', email: 'admin@example.com', app_metadata: { app_role: 'admin' } })
  const error = (() => {
    try {
      assertAdminActor({ id: 'actor', email: 'editor@example.com', app_metadata: { app_role: 'editor' } })
    } catch (caught) {
      return caught
    }
  })()
  assertEquals((error as ApiError).code, 'FORBIDDEN')
})

Deno.test('self mutation and last-admin mutation are rejected', async () => {
  await assertRejects(
    async () => assertTargetMutationAllowed({
      actorId: 'same', targetId: 'same', targetRole: 'admin', nextRole: 'viewer', adminCount: 2,
    }),
    ApiError,
    'SELF_MUTATION_FORBIDDEN',
  )
  await assertRejects(
    async () => assertTargetMutationAllowed({
      actorId: 'actor', targetId: 'last', targetRole: 'admin', nextRole: 'viewer', adminCount: 1,
    }),
    ApiError,
    'LAST_ADMIN_PROTECTED',
  )
})
