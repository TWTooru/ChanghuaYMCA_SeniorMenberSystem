import { supabase } from '../lib/supabaseClient'

/**
 * 封裝 `admin-users` Edge Function 的受保護管理操作。呼叫時由 Supabase client 自動附帶
 * access token，服務僅暴露穩定的 action 結果與錯誤碼給介面。
 */
/** 將 Edge Function 穩定錯誤碼包裝為可由介面判斷的錯誤型別。 */
export class AdminUserError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

/**
 * 封裝 `admin-users` Edge Function 的 action 呼叫；access token 由 Supabase client
 * 自動帶入。回應中的應用程式錯誤與傳輸錯誤一律轉為 `AdminUserError`。
 */
async function invoke(action, payload = {}) {
  const { data: { session } = {} } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new AdminUserError('UNAUTHENTICATED')
  }

  const { data, error } = await supabase.functions.invoke('admin-users', {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    body: { action, ...payload },
  })

  if (error) {
    let code = 'SUPABASE_AUTH_ERROR'
    try {
      const body = await error.context?.json?.()
      if (body?.error?.code) code = body.error.code
    } catch {
      // 保持穩定的備援錯誤碼，避免向介面洩漏傳輸或 Supabase 內部細節。
    }
    throw new AdminUserError(code)
  }

  if (data?.error?.code) throw new AdminUserError(data.error.code)
  return data
}

/** 透過 `admin-users` 的 `list_users` action 讀取可管理的使用者。 */
export const listUsers = () => invoke('list_users')
/** 透過 `admin-users` 的 `list_audit_logs` action 讀取管理稽核紀錄。 */
export const listAuditLogs = () => invoke('list_audit_logs')
/** 透過 `invite_user` action 以正規化電子郵件邀請使用者；角色由伺服器決定。 */
export const inviteUser = email =>
  invoke('invite_user', { email: email.trim().toLowerCase() })
/** 透過 `update_role` action 變更指定使用者的角色。 */
export const updateRole = (userId, role) => invoke('update_role', { userId, role })
/** 透過 `resend_invite` action 由伺服器解析收件者後重寄邀請。 */
export const resendInvite = userId => invoke('resend_invite', { userId })
/** 透過 `send_password_reset` action 由伺服器解析收件者後寄送重設信。 */
export const sendPasswordReset = userId => invoke('send_password_reset', { userId })
/** 透過 `delete_user` action 刪除使用者；`confirmEmail` 必須正規化後交由伺服器核對。 */
export const deleteUser = (userId, confirmEmail) =>
  invoke('delete_user', { userId, confirmEmail: confirmEmail.trim().toLowerCase() })
