import {
  ApiError,
  ERROR_STATUS,
  assertAccountManagerActor,
  assertActionBody,
  assertTargetMutationAllowed,
  normalizeEmail,
  requireAssignableRole,
  requireStoredRole,
  summarizeUser,
  type AccountMutationAction,
  type AppRole,
  type AssignableRole,
} from './domain.ts'

export type AuthUser = {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  invited_at?: string
  confirmed_at?: string
  created_at: string
  last_sign_in_at?: string
}

export type RoleRecord = { userId: string; role: AppRole }

type AccountActor = { id: string; email: string; role: AppRole }

export type HandlerDeps = {
  getActor(token: string): Promise<AuthUser | null>
  getRole(userId: string): Promise<AppRole | null>
  listUsers(): Promise<AuthUser[]>
  listRoles(userIds: string[]): Promise<RoleRecord[]>
  inviteUser(email: string): Promise<AuthUser>
  updateRole(
    userId: string,
    role: AssignableRole,
    expectedRole: AppRole,
  ): Promise<RoleRecord>
  countOwners(): Promise<number>
  deleteUser(userId: string, expectedRole: AppRole): Promise<void>
  resendInvite(email: string): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  insertAudit(row: Record<string, unknown>): Promise<{ id: string }>
  completeAudit(id: string, status: 'success' | 'failure', errorCode?: string): Promise<void>
  listAuditLogs(): Promise<Record<string, unknown>[]>
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function bearer(request: Request) {
  const value = request.headers.get('Authorization')
  if (!value?.startsWith('Bearer ')) throw new ApiError('UNAUTHENTICATED')
  const token = value.slice(7).trim()
  if (!token) throw new ApiError('UNAUTHENTICATED')
  return token
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError('INVALID_INPUT')
  }
}

async function loadActor(deps: HandlerDeps, token: string): Promise<AccountActor> {
  const actorUser = await deps.getActor(token)
  if (!actorUser) throw new ApiError('UNAUTHENTICATED')
  const actorRole = requireStoredRole(await deps.getRole(actorUser.id))
  const actor = { id: actorUser.id, email: actorUser.email ?? '', role: actorRole }
  assertAccountManagerActor(actor)
  return actor
}

function findTarget(users: AuthUser[], userId: unknown) {
  if (typeof userId !== 'string' || !userId) throw new ApiError('INVALID_INPUT')
  const target = users.find(user => user.id === userId)
  if (!target) throw new ApiError('USER_NOT_FOUND')
  return target
}

const errorCode = (caught: unknown): keyof typeof ERROR_STATUS =>
  caught instanceof ApiError ? caught.code : 'SUPABASE_AUTH_ERROR'

async function startAudit(deps: HandlerDeps, row: Record<string, unknown>) {
  try {
    return await deps.insertAudit(row)
  } catch {
    throw new ApiError('AUDIT_WRITE_ERROR')
  }
}

async function completeAudit(
  deps: HandlerDeps,
  id: string,
  status: 'success' | 'failure',
  code?: keyof typeof ERROR_STATUS,
) {
  try {
    await deps.completeAudit(id, status, code)
  } catch {
    throw new ApiError('AUDIT_WRITE_ERROR')
  }
}

export function createAdminUsersHandler(deps: HandlerDeps) {
  return async (request: Request) => {
    try {
      if (request.method !== 'POST') throw new ApiError('INVALID_INPUT')
      const actor = await loadActor(deps, bearer(request))
      const body = await requestBody(request)
      assertActionBody(body)

      if (body.action === 'list_users') {
        const users = await deps.listUsers()
        const roles = await deps.listRoles(users.map(user => user.id))
        const roleByUserId = new Map(roles.map(record => [record.userId, record.role]))
        return json(200, {
          users: users.map(user => summarizeUser(user, roleByUserId.get(user.id) ?? null)),
        })
      }

      if (body.action === 'list_audit_logs') {
        return json(200, { auditLogs: await deps.listAuditLogs() })
      }

      return await handleMutation(deps, actor, body.action, body)
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : new ApiError('SUPABASE_AUTH_ERROR')
      return json(ERROR_STATUS[error.code], { error: { code: error.code } })
    }
  }
}

async function loadTarget(deps: HandlerDeps, userId: unknown) {
  const users = await deps.listUsers()
  const user = findTarget(users, userId)
  return { user, role: await deps.getRole(user.id) }
}

async function isTargetSoleOwner(deps: HandlerDeps, userId: string): Promise<boolean> {
  try {
    const [role, ownerCount] = await Promise.all([deps.getRole(userId), deps.countOwners()])
    return role === 'owner' && ownerCount === 1
  } catch {
    return false
  }
}

function targetAuditRow(
  actor: AccountActor,
  action: AccountMutationAction,
  target: { user: AuthUser; role: AppRole | null },
  newRole?: AppRole,
) {
  return {
    actor_user_id: actor.id,
    actor_email: actor.email,
    actor_role: actor.role,
    action,
    target_user_id: target.user.id,
    target_email: target.user.email ?? '',
    old_role: target.role,
    ...(newRole === undefined ? {} : { new_role: newRole }),
    status: 'pending',
  }
}

async function runAuditedMutation<T>(
  deps: HandlerDeps,
  auditRow: Record<string, unknown>,
  mutation: () => Promise<T>,
) {
  const audit = await startAudit(deps, auditRow)
  let result: T
  try {
    result = await mutation()
  } catch (caught) {
    const code = errorCode(caught)
    await completeAudit(deps, audit.id, 'failure', code)
    throw new ApiError(code)
  }
  await completeAudit(deps, audit.id, 'success')
  return result
}

function assertTargetAllowed(
  actor: AccountActor,
  target: { user: AuthUser; role: AppRole | null },
  action: AccountMutationAction,
  nextRole?: AppRole,
) {
  assertTargetMutationAllowed({
    actorId: actor.id,
    actorRole: actor.role,
    targetId: target.user.id,
    targetRole: target.role,
    action,
    nextRole,
  })
}

async function handleMutation(
  deps: HandlerDeps,
  actor: AccountActor,
  action: string,
  body: Record<string, unknown>,
): Promise<Response> {
  switch (action) {
    case 'invite_user': {
      const email = normalizeEmail(body.email)
      const role: AppRole = 'viewer'
      const invited = await runAuditedMutation(deps, {
        actor_user_id: actor.id,
        actor_email: actor.email,
        actor_role: actor.role,
        action,
        target_email: email,
        new_role: role,
        status: 'pending',
      }, async () => {
        const users = await deps.listUsers()
        if (users.some(user => normalizeEmail(user.email) === email)) {
          throw new ApiError('USER_EXISTS')
        }
        const user = await deps.inviteUser(email)
        const storedRole = requireStoredRole(await deps.getRole(user.id))
        return { user, role: storedRole }
      })
      return json(200, { user: summarizeUser(invited.user, invited.role) })
    }

    case 'update_role': {
      const nextRole = requireAssignableRole(body.role)
      const target = await loadTarget(deps, body.userId)
      const updated = await runAuditedMutation(
        deps,
        targetAuditRow(actor, action, target, nextRole),
        async () => {
          assertTargetAllowed(actor, target, action, nextRole)
          if (!target.user.last_sign_in_at) throw new ApiError('FIRST_LOGIN_REQUIRED')
          return await deps.updateRole(
            target.user.id,
            nextRole,
            requireStoredRole(target.role),
          )
        },
      )
      return json(200, {
        user: summarizeUser(target.user, updated.role),
        requiresRelogin: true,
      })
    }

    case 'delete_user': {
      const target = await loadTarget(deps, body.userId)
      await runAuditedMutation(deps, targetAuditRow(actor, action, target), async () => {
        if (normalizeEmail(body.confirmEmail) !== normalizeEmail(target.user.email)) {
          throw new ApiError('EMAIL_CONFIRMATION_MISMATCH')
        }
        assertTargetAllowed(actor, target, action)
        if (target.role === 'owner' && await deps.countOwners() <= 1) {
          throw new ApiError('LAST_OWNER_REQUIRED')
        }
        try {
          await deps.deleteUser(target.user.id, requireStoredRole(target.role))
        } catch (caught) {
          if (await isTargetSoleOwner(deps, target.user.id)) {
            throw new ApiError('LAST_OWNER_REQUIRED')
          }
          throw caught
        }
      })
      return json(200, { deletedUserId: target.user.id })
    }

    case 'resend_invite':
    case 'send_password_reset': {
      const target = await loadTarget(deps, body.userId)
      const email = normalizeEmail(target.user.email)
      await runAuditedMutation(deps, targetAuditRow(actor, action, target), async () => {
        assertTargetAllowed(actor, target, action)
        if (action === 'resend_invite') await deps.resendInvite(email)
        else await deps.sendPasswordReset(email)
      })
      return json(200, { sent: true })
    }

    default:
      throw new ApiError('INVALID_INPUT')
  }
}
