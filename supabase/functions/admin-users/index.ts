import { createClient } from 'npm:@supabase/supabase-js@2.110.0'
import { createCorsHeaders } from '../_shared/cors.ts'
import { ApiError, type AppRole } from './domain.ts'
import { createAdminUsersHandler, type HandlerDeps } from './handler.ts'

type Environment = Record<string, string | undefined>
type SupabaseClientLike = any

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
  const secret = hostedSecret || env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error('Missing Supabase admin environment')
  return { url, secret }
}

function throwForError(error: unknown): never {
  const message = error instanceof Error
    ? error.message
    : [
      (error as any)?.message,
      (error as any)?.code,
      (error as any)?.details,
      (error as any)?.hint,
    ].filter(Boolean).join(' ')
  if (message.includes('LAST_ADMIN_PROTECTED')) throw new ApiError('LAST_ADMIN_PROTECTED')
  throw new ApiError('SUPABASE_AUTH_ERROR')
}

function unwrap<T>(result: { data: T; error: unknown }): T {
  if (result.error) throwForError(result.error)
  return result.data
}

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

export function createSupabaseDeps(client: SupabaseClientLike, env: Environment): HandlerDeps {
  const inviteOptions = (role: AppRole) => ({
    data: { app_role: role },
    ...(env.INVITE_REDIRECT_URL ? { redirectTo: env.INVITE_REDIRECT_URL } : {}),
  })
  const redirectOptions = (url: string | undefined) => url ? { redirectTo: url } : {}

  return {
    async getActor(token) {
      const { data, error } = await client.auth.getUser(token)
      // Invalid or expired bearer tokens deliberately become the handler's stable 401.
      if (error && ([401, 403].includes((error as any).status))) return null
      if (error) throwForError(error)
      return data.user
    },
    async listUsers() {
      return unwrap<any>(await client.auth.admin.listUsers({ page: 1, perPage: 100 })).users
    },
    async inviteUser(email, role) {
      return unwrap<any>(await client.auth.admin.inviteUserByEmail(email, inviteOptions(role))).user
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

export function createRuntimeHandler(env: Environment) {
  const { url, secret } = requiredEnv(env)
  const adminClient = createClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const handler = createAdminUsersHandler(createSupabaseDeps(adminClient, env))
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
