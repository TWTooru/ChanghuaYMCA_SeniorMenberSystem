import { createClient } from 'npm:@supabase/supabase-js@2.110.0'
import { createCorsHeaders } from '../_shared/cors.ts'
import { ApiError } from './domain.ts'
import { createAdminUsersHandler, type HandlerDeps } from './handler.ts'

type Environment = Record<string, string | undefined>
type SupabaseClientLike = any

/**
 * 讀取 Edge Function 在 Deno 執行時注入的連線設定。
 *
 * 部署環境可能同時提供 hosted 的 secret bundle 與相容舊設定的單一 secret；
 * 這裡集中處理其優先順序，避免 adapter 的其餘部分依賴部署細節。
 */
export function requiredEnv(env: Environment) {
  const url = env.SUPABASE_URL
  let hostedSecret: string | undefined
  try {
    hostedSecret = env.SUPABASE_SECRET_KEYS
      ? JSON.parse(env.SUPABASE_SECRET_KEYS).default
      : undefined
  } catch {
    hostedSecret = undefined
  }
  // 舊版 service-role key 優先，接著是單一 secret，最後才讀 hosted secret bundle。
  const secret = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || hostedSecret
  if (!url || !secret) throw new Error('Missing Supabase admin environment')
  return { url, secret }
}

function throwForError(error: unknown): never {
  const status = error && typeof error === 'object'
    ? (error as { status?: number }).status
    : undefined
  const message = error instanceof Error
    ? error.message
    : [
      (error as any)?.message,
      (error as any)?.code,
      (error as any)?.details,
      (error as any)?.hint,
    ].filter(Boolean).join(' ')
  // 僅保留 handler/domain 可依賴的穩定代碼，勿將 Supabase 的 message/details/hint 洩漏給呼叫端。
  if (message.includes('LAST_ADMIN_PROTECTED')) throw new ApiError('LAST_ADMIN_PROTECTED')
  if (status === 429 && message.toLowerCase().includes('email rate limit exceeded')) {
    throw new ApiError('EMAIL_RATE_LIMITED')
  }
  throw new ApiError('SUPABASE_AUTH_ERROR')
}

function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throwForError(result.error)
  return result.data
}

// 將資料庫的 snake_case 稽核欄位轉為 domain/handler 對外使用的 camelCase。
function mapAuditLog(row: Record<string, any>) {
  return {
    id: row.id,
    actorEmail: row.actor_email,
    action: row.action,
    targetEmail: row.target_email,
    oldRole: row.old_role,
    newRole: row.new_role,
    status: row.status,
    errorCode: row.error_code,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  }
}

/**
 * 將 Supabase SDK 的呼叫包裝成 handler 所需的 `HandlerDeps`。
 * 此 adapter 是 SDK 與 use case 的邊界：集中轉換 SDK 回傳值、redirect 選項與穩定錯誤，
 * 使 handler 不必認識 Supabase 的型別或錯誤格式。
 */
export function createSupabaseDeps(client: SupabaseClientLike, env: Environment): HandlerDeps {
  const inviteOptions = () => ({
    ...(env.INVITE_REDIRECT_URL ? { redirectTo: env.INVITE_REDIRECT_URL } : {}),
  })
  const redirectOptions = (url: string | undefined) => url ? { redirectTo: url } : {}

  return {
    async getActor(token) {
      const { data, error } = await client.auth.getUser(token)
      // 無效或過期的 bearer token 以 null 交給 handler 統一產生穩定的 UNAUTHENTICATED 401。
      if (error && ([401, 403].includes((error as any).status))) return null
      if (error) throwForError(error)
      return data.user
    },
    async listUsers() {
      return unwrap<any>(await client.auth.admin.listUsers({ page: 1, perPage: 100 })).users
    },
    async inviteUser(email) {
      return unwrap<any>(await client.auth.admin.inviteUserByEmail(email, inviteOptions())).user
    },
    async updateUser(id, attributes) {
      return unwrap<any>(await client.auth.admin.updateUserById(id, attributes)).user
    },
    async deleteUser(id) {
      const result = await client.auth.admin.deleteUser(id)
      if (result.error) throwForError(result.error)
    },
    async resendInvite(email) {
      const result = await client.auth.admin.inviteUserByEmail(email, redirectOptions(env.INVITE_REDIRECT_URL))
      if (result.error) throwForError(result.error)
    },
    async sendPasswordReset(email) {
      const result = await client.auth.resetPasswordForEmail(email, redirectOptions(env.PASSWORD_RESET_REDIRECT_URL))
      if (result.error) throwForError(result.error)
    },
    async insertAudit(row) {
      return unwrap<any>(await client.from('admin_audit_logs').insert(row).select('id').single())
    },
    async completeAudit(id, status, errorCode) {
      const result = await client.from('admin_audit_logs').update({
        status,
        error_code: errorCode ?? null,
        completed_at: new Date().toISOString(),
      }).eq('id', id)
      if (result.error) throwForError(result.error)
    },
    async listAuditLogs() {
      const rows = unwrap<any[]>(await client.from('admin_audit_logs').select('*').order('created_at', { ascending: false }).limit(100))
      return rows.map(mapAuditLog)
    },
  }
}

/**
 * Deno runtime adapter：建立 service-role client、注入 Supabase adapter，並以 CORS 包裝 handler response。
 * 這一層只負責執行環境與 HTTP 邊界；授權、輸入驗證與回應語意皆維持在 handler/domain。
 */
export function createRuntimeHandler(env: Environment) {
  const { url, secret } = requiredEnv(env)
  const adminClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const handler = createAdminUsersHandler(createSupabaseDeps(adminClient, env))
  // 正式環境必須指定單一 dashboard origin，拒絕 `*` 以免 credentialed CORS 退化為不安全設定。
  const allowedOrigin = env.ALLOWED_ORIGIN || 'http://localhost:5173'
  if (allowedOrigin === '*') throw new Error('ALLOWED_ORIGIN must be an exact dashboard origin')
  const corsHeaders = createCorsHeaders(allowedOrigin)
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders })
    const response = await handler(request)
    for (const [name, value] of Object.entries(corsHeaders)) response.headers.set(name, value)
    return response
  }
}

if (import.meta.main) Deno.serve(createRuntimeHandler(Deno.env.toObject()))
