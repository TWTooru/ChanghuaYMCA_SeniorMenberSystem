export const APP_ROLES = ['viewer', 'editor', 'admin'] as const
export type AppRole = typeof APP_ROLES[number]

export type AdminAction =
  | 'list_users'
  | 'invite_user'
  | 'update_role'
  | 'resend_invite'
  | 'send_password_reset'
  | 'delete_user'
  | 'list_audit_logs'

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
  LAST_ADMIN_PROTECTED: 409,
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

export function normalizeRole(value: unknown): AppRole {
  return APP_ROLES.includes(value as AppRole) ? value as AppRole : 'viewer'
}

export function requireRole(value: unknown): AppRole {
  if (!APP_ROLES.includes(value as AppRole)) throw new ApiError('INVALID_INPUT')
  return value as AppRole
}

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError('INVALID_INPUT')
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('INVALID_INPUT')
  return email
}

export function assertAdminActor(user: {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
} | null): asserts user is { id: string; email: string; app_metadata: Record<string, unknown> } {
  if (!user) throw new ApiError('UNAUTHENTICATED')
  if (!user.email || normalizeRole(user.app_metadata?.app_role) !== 'admin') {
    throw new ApiError('FORBIDDEN')
  }
}

export function assertTargetMutationAllowed(input: {
  actorId: string
  targetId: string
  targetRole: AppRole
  nextRole?: AppRole
  adminCount: number
}) {
  if (input.actorId === input.targetId) throw new ApiError('SELF_MUTATION_FORBIDDEN')
  const removesAdmin = input.targetRole === 'admin' && input.nextRole !== 'admin'
  if (removesAdmin && input.adminCount <= 1) throw new ApiError('LAST_ADMIN_PROTECTED')
}

export function summarizeUser(user: {
  id: string
  email?: string
  app_metadata?: Record<string, unknown>
  invited_at?: string
  confirmed_at?: string
  created_at: string
  last_sign_in_at?: string
}) {
  return {
    id: user.id,
    email: user.email ?? '',
    role: normalizeRole(user.app_metadata?.app_role),
    status: user.confirmed_at ? 'active' : 'invited',
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at ?? null,
  }
}
