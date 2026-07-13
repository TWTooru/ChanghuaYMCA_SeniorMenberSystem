import {
  ApiError,
  ERROR_STATUS,
  assertActionBody,
  assertAdminActor,
  summarizeUser,
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
  return value.slice(7)
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new ApiError('INVALID_INPUT')
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
    case 'invite_user':
    case 'update_role':
    case 'resend_invite':
    case 'send_password_reset':
    case 'delete_user':
      throw new ApiError('INVALID_INPUT')
    default:
      throw new ApiError('INVALID_INPUT')
  }
}
