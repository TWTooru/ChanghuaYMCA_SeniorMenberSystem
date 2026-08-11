/**
 * `admin-users` 的純領域規則：限制 action 輸入、正規化角色與 Email，並保護特權帳號操作。
 * 這裡不存取外部服務；handler 會在執行 mutation 前使用這些規則，避免不受信任資料直接進入 Auth。
 */
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

/** 每種 request body 只允許明確列出的 keys，阻擋未預期欄位流入特權 handler。 */
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

/** 對未知或遺漏的 stored role 採取 fail-closed 的 `viewer` 預設值。 */
export function normalizeRole(value: unknown): AppRole {
  return APP_ROLES.includes(value as AppRole) ? value as AppRole : 'viewer'
}

/** 僅接受 allowlist 中的 mutation 角色，避免將任意值寫入使用者 metadata。 */
export function requireRole(value: unknown): AppRole {
  if (!APP_ROLES.includes(value as AppRole)) throw new ApiError('INVALID_INPUT')
  return value as AppRole
}

/** 正規化並驗證 Email，讓重複帳號與刪除確認都使用一致的比較值。 */
export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') throw new ApiError('INVALID_INPUT')
  const email = value.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ApiError('INVALID_INPUT')
  return email
}

/** 以 fresh actor 的 `app_metadata.app_role` 驗證管理員權限，而非信任可能過期的 JWT 宣告。 */
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

/** 阻擋自我 mutation 與移除最後一位管理員，維持至少一個可管理帳號。 */
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

/** 將 Auth user 投影為 UI 所需的安全欄位，避免洩漏完整 metadata。 */
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
