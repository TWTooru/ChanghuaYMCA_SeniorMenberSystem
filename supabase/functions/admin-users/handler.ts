import {
  ApiError,
  ERROR_STATUS,
  assertActionBody,
  assertAdminActor,
  assertTargetMutationAllowed,
  normalizeEmail,
  normalizeRole,
  requireRole,
  summarizeUser,
  type AppRole,
} from './domain.ts'

export type HandlerDeps = {
  getActor(token: string): Promise<any>
  listUsers(): Promise<any[]>
  inviteUser(email: string): Promise<any>
  updateUser(id: string, attributes: Record<string, unknown>): Promise<any>
  deleteUser(id: string): Promise<void>
  resendInvite(email: string): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  insertAudit(row: Record<string, unknown>): Promise<{ id: string }>
  completeAudit(id: string, status: 'success' | 'failure', errorCode?: string): Promise<void>
  listAuditLogs(): Promise<any[]>
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

const adminCount = (users: any[]) =>
  users.filter(user => normalizeRole(user.app_metadata?.app_role) === 'admin').length

const findTarget = (users: any[], userId: unknown) => {
  if (typeof userId !== 'string' || !userId) throw new ApiError('INVALID_INPUT')
  const target = users.find(user => user.id === userId)
  if (!target) throw new ApiError('USER_NOT_FOUND')
  return target
}

const errorCode = (caught: unknown) =>
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
      const actor = await deps.getActor(bearer(request))
      assertAdminActor(actor)
      const body = await requestBody(request)
      assertActionBody(body)
      const action = body.action

      if (action === 'list_users') {
        const users = await deps.listUsers()
        return json(200, { users: users.map(summarizeUser) })
      }
      if (action === 'list_audit_logs') {
        return json(200, { auditLogs: await deps.listAuditLogs() })
      }

      return await handleMutation(deps, actor, action, body)
    } catch (caught) {
      const error = caught instanceof ApiError ? caught : new ApiError('SUPABASE_AUTH_ERROR')
      return json(ERROR_STATUS[error.code], { error: { code: error.code } })
    }
  }
}

async function handleMutation(
  deps: HandlerDeps,
  actor: any,
  action: unknown,
  body: Record<string, unknown>,
): Promise<Response> {
  switch (action) {
    case 'invite_user': {
      const email = normalizeEmail(body.email)
      const role: AppRole = 'viewer'
      const audit = await startAudit(deps, {
        actor_user_id: actor.id, actor_email: actor.email, action,
        target_email: email, new_role: role, status: 'pending',
      })
      let invited: any
      try {
        const users = await deps.listUsers()
        if (users.some(user => normalizeEmail(user.email) === email)) {
          throw new ApiError('USER_EXISTS')
        }
        invited = await deps.inviteUser(email)
      } catch (caught) {
        const code = errorCode(caught)
        await completeAudit(deps, audit.id, 'failure', code)
        throw new ApiError(code)
      }
      await completeAudit(deps, audit.id, 'success')
      return json(200, { user: summarizeUser(invited) })
    }

    case 'update_role': {
      const role = requireRole(body.role)
      const users = await deps.listUsers()
      const target = findTarget(users, body.userId)
      const targetRole = normalizeRole(target.app_metadata?.app_role)
      const audit = await startAudit(deps, {
        actor_user_id: actor.id, actor_email: actor.email, action,
        target_user_id: target.id, target_email: target.email,
        old_role: targetRole, new_role: role, status: 'pending',
      })
      let updated: any
      try {
        assertTargetMutationAllowed({
          actorId: actor.id, targetId: target.id, targetRole,
          nextRole: role, adminCount: adminCount(users),
        })
        updated = await deps.updateUser(target.id, {
          app_metadata: { ...target.app_metadata, app_role: role },
        })
      } catch (caught) {
        const code = errorCode(caught)
        await completeAudit(deps, audit.id, 'failure', code)
        throw new ApiError(code)
      }
      await completeAudit(deps, audit.id, 'success')
      return json(200, { user: summarizeUser(updated), requiresRelogin: true })
    }

    case 'delete_user': {
      const users = await deps.listUsers()
      const target = findTarget(users, body.userId)
      const targetRole = normalizeRole(target.app_metadata?.app_role)
      const audit = await startAudit(deps, {
        actor_user_id: actor.id, actor_email: actor.email, action,
        target_user_id: target.id, target_email: target.email,
        old_role: targetRole, status: 'pending',
      })
      try {
        if (normalizeEmail(body.confirmEmail) !== normalizeEmail(target.email)) {
          throw new ApiError('EMAIL_CONFIRMATION_MISMATCH')
        }
        assertTargetMutationAllowed({
          actorId: actor.id, targetId: target.id, targetRole,
          nextRole: undefined, adminCount: adminCount(users),
        })
        await deps.deleteUser(target.id)
      } catch (caught) {
        const code = errorCode(caught)
        await completeAudit(deps, audit.id, 'failure', code)
        throw new ApiError(code)
      }
      await completeAudit(deps, audit.id, 'success')
      return json(200, { deletedUserId: target.id })
    }

    case 'resend_invite':
    case 'send_password_reset': {
      const users = await deps.listUsers()
      const target = findTarget(users, body.userId)
      const email = normalizeEmail(target.email)
      const audit = await startAudit(deps, {
        actor_user_id: actor.id, actor_email: actor.email, action,
        target_user_id: target.id, target_email: email, status: 'pending',
      })
      try {
        if (action === 'resend_invite') await deps.resendInvite(email)
        else await deps.sendPasswordReset(email)
      } catch (caught) {
        const code = errorCode(caught)
        await completeAudit(deps, audit.id, 'failure', code)
        throw new ApiError(code)
      }
      await completeAudit(deps, audit.id, 'success')
      return json(200, { sent: true })
    }

    default:
      throw new ApiError('INVALID_INPUT')
  }
}
