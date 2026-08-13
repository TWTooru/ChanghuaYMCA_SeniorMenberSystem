import { assertEquals, assertRejects } from 'jsr:@std/assert'
import {
  ApiError,
  assertActionBody,
  assertAdminActor,
  assertTargetMutationAllowed,
  normalizeRole,
} from './domain.ts'

Deno.test('invalid role fails closed to viewer', () => {
  // 未知 stored role 必須降為 viewer，避免意外保有特權。
  assertEquals(normalizeRole('owner'), 'viewer')
  assertEquals(normalizeRole(undefined), 'viewer')
})

Deno.test('action bodies reject unknown actions and fields', () => {
  // 特權 action 的 allowlist 需同時拒絕未知 action 與額外輸入欄位。
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
  // handler guard 只接受 fresh actor 的 admin metadata，而非用戶端聲稱的角色。
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
  // 角色變更與刪除共用的 guard 必須保護操作者本人與最後一位管理員。
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
