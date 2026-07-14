import { supabase } from '../lib/supabaseClient'

export class AdminUserError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

async function invoke(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body: { action, ...payload },
  })

  if (error) {
    let code = 'SUPABASE_AUTH_ERROR'
    try {
      const body = await error.context?.json?.()
      if (body?.error?.code) code = body.error.code
    } catch {
      // Keep the stable fallback; never expose transport or Supabase internals.
    }
    throw new AdminUserError(code)
  }

  if (data?.error?.code) throw new AdminUserError(data.error.code)
  return data
}

export const listUsers = () => invoke('list_users')
export const listAuditLogs = () => invoke('list_audit_logs')
export const inviteUser = email =>
  invoke('invite_user', { email: email.trim().toLowerCase() })
export const updateRole = (userId, role) => invoke('update_role', { userId, role })
export const resendInvite = userId => invoke('resend_invite', { userId })
export const sendPasswordReset = userId => invoke('send_password_reset', { userId })
export const deleteUser = (userId, confirmEmail) =>
  invoke('delete_user', { userId, confirmEmail: confirmEmail.trim().toLowerCase() })
