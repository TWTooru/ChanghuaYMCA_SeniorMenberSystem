import { assertEquals, assertThrows } from 'jsr:@std/assert'
import {
  ApiError,
  ERROR_STATUS,
  assertAccountManagerActor,
  assertActionBody,
  assertTargetMutationAllowed,
  parseStoredRole,
  requireAssignableRole,
  requireStoredRole,
  summarizeUser,
  type AccountMutationAction,
} from './domain.ts'

function assertApiError(code: keyof typeof ERROR_STATUS, operation: () => unknown) {
  const error = assertThrows(operation, ApiError, code)
  assertEquals(error.code, code)
}

const mutationActions: readonly AccountMutationAction[] = [
  'update_role',
  'delete_user',
  'resend_invite',
  'send_password_reset',
]

Deno.test('stored role parsing accepts only the four persisted roles', () => {
  assertEquals(
    ['viewer', 'editor', 'admin', 'owner'].map(parseStoredRole),
    ['viewer', 'editor', 'admin', 'owner'],
  )
  for (const value of [undefined, null, '', 'OWNER', 'superadmin', 1, {}]) {
    assertEquals(parseStoredRole(value), null)
  }
})

Deno.test('required stored roles fail closed when missing or invalid', () => {
  assertEquals(requireStoredRole('owner'), 'owner')
  for (const value of [undefined, null, 'unknown']) {
    assertApiError('ROLE_NOT_ASSIGNED', () => requireStoredRole(value))
  }
})

Deno.test('all roles including owner are assignable', () => {
  assertEquals(
    ['viewer', 'editor', 'admin', 'owner'].map(requireAssignableRole),
    ['viewer', 'editor', 'admin', 'owner'],
  )
  for (const value of [undefined, 'unknown']) {
    assertApiError('INVALID_INPUT', () => requireAssignableRole(value))
  }
})

Deno.test('action bodies reject unknown actions and fields', () => {
  for (const body of [
    { action: 'unknown' },
    { action: 'list_users', leaked: true },
    { action: 'resend_invite', userId: 'u1', email: 'untrusted@example.com' },
  ]) {
    assertApiError('INVALID_INPUT', () => assertActionBody(body))
  }
})

Deno.test('role-boundary errors have stable HTTP statuses', () => {
  assertEquals(
    {
      ROLE_NOT_ASSIGNED: ERROR_STATUS.ROLE_NOT_ASSIGNED,
      OWNER_PROTECTED: ERROR_STATUS.OWNER_PROTECTED,
      LAST_OWNER_REQUIRED: ERROR_STATUS.LAST_OWNER_REQUIRED,
      ADMIN_TARGET_FORBIDDEN: ERROR_STATUS.ADMIN_TARGET_FORBIDDEN,
      OWNER_REQUIRED: ERROR_STATUS.OWNER_REQUIRED,
      ROLE_STORE_ERROR: ERROR_STATUS.ROLE_STORE_ERROR,
    },
    {
      ROLE_NOT_ASSIGNED: 403,
      OWNER_PROTECTED: 409,
      LAST_OWNER_REQUIRED: 409,
      ADMIN_TARGET_FORBIDDEN: 403,
      OWNER_REQUIRED: 403,
      ROLE_STORE_ERROR: 500,
    },
  )
})

Deno.test('account manager actor requires authentication', () => {
  assertApiError('UNAUTHENTICATED', () => assertAccountManagerActor(null))
})

Deno.test('account manager actor requires a valid stored role', () => {
  for (const role of [undefined, null, 'invalid']) {
    assertApiError('ROLE_NOT_ASSIGNED', () => {
      assertAccountManagerActor({ id: 'actor', email: 'actor@example.com', role })
    })
  }
})

Deno.test('viewer and editor actors cannot manage accounts', () => {
  for (const role of ['viewer', 'editor'] as const) {
    assertApiError('FORBIDDEN', () => {
      assertAccountManagerActor({ id: `${role}-id`, email: `${role}@example.com`, role })
    })
  }
})

Deno.test('owner and admin actors can manage accounts from stored roles', () => {
  for (const role of ['owner', 'admin'] as const) {
    assertEquals(
      assertAccountManagerActor({ id: `${role}-id`, email: '', role }),
      undefined,
    )
  }
})

Deno.test('self mutation is forbidden for owners and admins across every action', () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    for (const action of mutationActions) {
      assertApiError('SELF_MUTATION_FORBIDDEN', () => {
        assertTargetMutationAllowed({
          actorId: `${actorRole}-id`,
          actorRole,
          targetId: `${actorRole}-id`,
          targetRole: actorRole,
          action,
          nextRole: action === 'update_role' ? 'viewer' : undefined,
        })
      })
    }
  }
})

Deno.test('self protection takes precedence over a missing target role', () => {
  assertApiError('SELF_MUTATION_FORBIDDEN', () => {
    assertTargetMutationAllowed({
      actorId: 'same-id',
      actorRole: 'admin',
      targetId: 'same-id',
      targetRole: null,
      action: 'delete_user',
    })
  })
})

Deno.test('a missing target role fails closed before role-specific checks', () => {
  for (const actorRole of ['owner', 'admin'] as const) {
    assertApiError('ROLE_NOT_ASSIGNED', () => {
      assertTargetMutationAllowed({
        actorId: `${actorRole}-id`,
        actorRole,
        targetId: 'orphan-id',
        targetRole: null,
        action: 'update_role',
        nextRole: 'admin',
      })
    })
  }
})

Deno.test('owners are protected from non-owner account managers across all actions', () => {
  for (const action of mutationActions) {
    assertApiError('OWNER_PROTECTED', () => {
      assertTargetMutationAllowed({
        actorId: 'admin-actor',
        actorRole: 'admin',
        targetId: 'owner-target',
        targetRole: 'owner',
        action,
        nextRole: action === 'update_role' ? 'viewer' : undefined,
      })
    })
  }
})

Deno.test('owner can manage another owner across actions and assign every role', () => {
  for (const action of mutationActions) {
    for (const nextRole of action === 'update_role'
      ? ['viewer', 'editor', 'admin', 'owner'] as const
      : [undefined]) {
      assertTargetMutationAllowed({
        actorId: 'owner-actor-1',
        actorRole: 'owner',
        targetId: 'owner-actor-2',
        targetRole: 'owner',
        action,
        nextRole,
      })
    }
  }
})

Deno.test('admin updating or deleting another admin requires an owner', () => {
  for (const action of ['update_role', 'delete_user'] as const) {
    assertApiError('OWNER_REQUIRED', () => {
      assertTargetMutationAllowed({
        actorId: 'admin-a',
        actorRole: 'admin',
        targetId: 'admin-b',
        targetRole: 'admin',
        action,
        nextRole: action === 'update_role' ? 'editor' : undefined,
      })
    })
  }
})

Deno.test('admin cannot resend or reset credentials for another admin', () => {
  for (const action of ['resend_invite', 'send_password_reset'] as const) {
    assertApiError('ADMIN_TARGET_FORBIDDEN', () => {
      assertTargetMutationAllowed({
        actorId: 'admin-a',
        actorRole: 'admin',
        targetId: 'admin-b',
        targetRole: 'admin',
        action,
      })
    })
  }
})

Deno.test('admin cannot promote viewer or editor targets to privileged roles', () => {
  for (const targetRole of ['viewer', 'editor'] as const) {
    for (const nextRole of ['admin', 'owner'] as const) {
      assertApiError('OWNER_REQUIRED', () => {
        assertTargetMutationAllowed({
          actorId: 'admin-id',
          actorRole: 'admin',
          targetId: `${targetRole}-id`,
          targetRole,
          action: 'update_role',
          nextRole,
        })
      })
    }
  }
})

Deno.test('admin can manage viewer and editor targets without escalating them', () => {
  for (const targetRole of ['viewer', 'editor'] as const) {
    for (const action of mutationActions) {
      assertEquals(
        assertTargetMutationAllowed({
          actorId: 'admin-id',
          actorRole: 'admin',
          targetId: `${targetRole}-id`,
          targetRole,
          action,
          nextRole: action === 'update_role'
            ? targetRole === 'viewer' ? 'editor' : 'viewer'
            : undefined,
        }),
        undefined,
      )
    }
  }
})

Deno.test('owner can manage another admin across every action', () => {
  for (const action of mutationActions) {
    assertEquals(
      assertTargetMutationAllowed({
        actorId: 'owner-id',
        actorRole: 'owner',
        targetId: 'admin-id',
        targetRole: 'admin',
        action,
        nextRole: action === 'update_role' ? 'editor' : undefined,
      }),
      undefined,
    )
  }
})

Deno.test('owner can manage and promote viewer and editor targets', () => {
  for (const targetRole of ['viewer', 'editor'] as const) {
    for (const action of mutationActions) {
      assertEquals(
        assertTargetMutationAllowed({
          actorId: 'owner-id',
          actorRole: 'owner',
          targetId: `${targetRole}-id`,
          targetRole,
          action,
          nextRole: action === 'update_role' ? 'admin' : undefined,
        }),
        undefined,
      )
    }
  }
})

Deno.test('target guard fails closed for non-manager roles', () => {
  for (const actorRole of ['viewer', 'editor'] as const) {
    assertApiError('FORBIDDEN', () => {
      assertTargetMutationAllowed({
        actorId: `${actorRole}-id`,
        actorRole,
        targetId: 'viewer-target',
        targetRole: 'viewer',
        action: 'delete_user',
      })
    })
  }
})

Deno.test('user summary uses only the explicit stored role', () => {
  const createdAt = '2026-08-24T00:00:00.000Z'
  assertEquals(
    summarizeUser({
      id: 'user-id',
      email: 'user@example.com',
      app_metadata: { app_role: 'owner' },
      user_metadata: { app_role: 'admin' },
      confirmed_at: '2026-08-24T00:01:00.000Z',
      created_at: createdAt,
    }, 'viewer'),
    {
      id: 'user-id',
      email: 'user@example.com',
      role: 'viewer',
      status: 'active',
      createdAt,
      lastSignInAt: null,
    },
  )
})

Deno.test('user summary keeps a missing stored role null despite metadata', () => {
  assertEquals(
    summarizeUser({
      id: 'orphan-id',
      email: 'orphan@example.com',
      app_metadata: { app_role: 'admin' },
      user_metadata: { app_role: 'owner' },
      created_at: '2026-08-24T00:00:00.000Z',
    }, null).role,
    null,
  )
})
