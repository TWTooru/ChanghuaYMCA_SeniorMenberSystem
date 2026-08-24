/** Pure request validation and account-management authorization rules. */
export const APP_ROLES = ['viewer', 'editor', 'admin', 'owner'] as const
export const ASSIGNABLE_ROLES = ['viewer', 'editor', 'admin'] as const

export type AppRole = typeof APP_ROLES[number]
export type AssignableRole = typeof ASSIGNABLE_ROLES[number]

export type AdminAction =
  | 'list_users'
  | 'invite_user'
  | 'update_role'
  | 'resend_invite'
  | 'send_password_reset'
  | 'delete_user'
  | 'list_audit_logs'

export type AccountMutationAction =
  | 'update_role'
  | 'delete_user'
  | 'resend_invite'
  | 'send_password_reset'

const ACTION_KEYS: Record<AdminAction, readonly string[]> = {
  list_users: ['action'],
  invite_user: ['action', 'email', 'role'],
  update_role: ['action', 'userId', 'role'],
  resend_invite: ['action', 'userId'],
  send_password_reset: ['action', 'userId'],
  delete_user: ['action', 'userId', 'confirmEmail'],
  list_audit_logs: ['action'],
}

export const ERROR_STATUS = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  USER_EXISTS: 409,
  USER_NOT_FOUND: 404,
  SELF_MUTATION_FORBIDDEN: 409,
  ROLE_NOT_ASSIGNED: 403,
  OWNER_PROTECTED: 409,
  ADMIN_TARGET_FORBIDDEN: 403,
  OWNER_REQUIRED: 403,
  ROLE_STORE_ERROR: 500,
  FIRST_LOGIN_REQUIRED: 409,
  EMAIL_CONFIRMATION_MISMATCH: 400,
  EMAIL_RATE_LIMITED: 429,
  SUPABASE_AUTH_ERROR: 502,
  AUDIT_WRITE_ERROR: 500,
} as const

export class ApiError extends Error {
  constructor(public code: keyof typeof ERROR_STATUS, message = code) {
    super(message)
  }
}

export function assertActionBody(
  value: unknown,
): asserts value is Record<string, unknown> & { action: AdminAction } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError('INVALID_INPUT')
  }
  const action = (value as Record<string, unknown>).action
  if (typeof action !== 'string' || !Object.prototype.hasOwnProperty.call(ACTION_KEYS, action)) {
    throw new ApiError('INVALID_INPUT')
  }
  const allowed = ACTION_KEYS[action as AdminAction]
  if (Object.keys(value).some(key => !allowed.includes(key))) {
    throw new ApiError('INVALID_INPUT')
  }
}

export function parseStoredRole(value: unknown): AppRole | null {
  return APP_ROLES.includes(value as AppRole) ? value as AppRole : null
}

export function requireStoredRole(value: unknown): AppRole {
  const role = parseStoredRole(value)
  if (!role) throw new ApiError('ROLE_NOT_ASSIGNED')
  return role
}

export function requireAssignableRole(value: unknown): AssignableRole {
  if (!ASSIGNABLE_ROLES.includes(value as AssignableRole)) {
    throw new ApiError('INVALID_INPUT')
  }
  return value as AssignableRole
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError('INVALID_INPUT')
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('INVALID_INPUT')
  return email
}

export function assertAccountManagerActor(actor: {
  id: string
  email?: string
  role?: unknown
} | null): asserts actor is {
  id: string
  email?: string
  role: 'admin' | 'owner'
} {
  if (!actor) throw new ApiError('UNAUTHENTICATED')
  const role = requireStoredRole(actor.role)
  if (role !== 'admin' && role !== 'owner') throw new ApiError('FORBIDDEN')
}

export function assertTargetMutationAllowed(input: {
  actorId: string
  actorRole: AppRole
  targetId: string
  targetRole: AppRole | null
  action: AccountMutationAction
  nextRole?: AssignableRole
}): void {
  if (input.actorId === input.targetId) {
    throw new ApiError('SELF_MUTATION_FORBIDDEN')
  }

  const targetRole = requireStoredRole(input.targetRole)
  if (targetRole === 'owner') throw new ApiError('OWNER_PROTECTED')

  if (input.actorRole === 'admin' && targetRole === 'admin') {
    if (input.action === 'update_role' || input.action === 'delete_user') {
      throw new ApiError('OWNER_REQUIRED')
    }
    throw new ApiError('ADMIN_TARGET_FORBIDDEN')
  }

  if (input.actorRole === 'admin' && input.nextRole === 'admin') {
    throw new ApiError('OWNER_REQUIRED')
  }

  if (input.actorRole !== 'admin' && input.actorRole !== 'owner') {
    throw new ApiError('FORBIDDEN')
  }
}

export function summarizeUser(user: {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  user_metadata?: Record<string, unknown>
  invited_at?: string
  confirmed_at?: string
  created_at: string
  last_sign_in_at?: string
}, role: AppRole | null) {
  return {
    id: user.id,
    email: user.email ?? '',
    role,
    status: user.confirmed_at ? 'active' : 'invited',
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  }
}
