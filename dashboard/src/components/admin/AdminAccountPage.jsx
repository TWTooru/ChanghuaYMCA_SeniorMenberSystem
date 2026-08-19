import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import useAdminUsers from '../../hooks/useAdminUsers'
import AdminAuditLog from './AdminAuditLog'
import DeleteUserDialog from './DeleteUserDialog'
import InviteUserModal from './InviteUserModal'
import './admin.css'

/**
 * 帳號管理頁僅負責呈現 UI 與 session role 的前端守門；所有 admin-users Edge Function
 * 請求仍以伺服器端取得的最新操作者身分授權，避免僅依賴 UI 判斷。
 */
const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '瀏覽者' }
const ERROR_MESSAGES = {
  FIRST_LOGIN_REQUIRED: '受邀帳號必須先完成首次登入，之後才能變更角色。',
  UNAUTHENTICATED: '登入已逾期，請重新登入後再試。',
  FORBIDDEN: '您沒有執行帳號管理操作的權限。',
  INVALID_INPUT: '輸入資料格式不正確。', USER_EXISTS: '此 Email 已有帳號。',
  USER_NOT_FOUND: '找不到指定的帳號。', SELF_MUTATION_FORBIDDEN: '不能變更自己的角色或刪除自己的帳號。',
  LAST_ADMIN_PROTECTED: '至少保留一位管理員帳號。', EMAIL_CONFIRMATION_MISMATCH: '確認 Email 與目標帳號不一致。',
  EMAIL_RATE_LIMITED: '邀請信寄送額度已滿，帳號可能已建立，請稍後從列表重新寄送邀請。',
  SUPABASE_AUTH_ERROR: '帳號服務暫時無法使用，請稍後再試。', AUDIT_WRITE_ERROR: '無法寫入操作紀錄，操作未完成。',
}

export default function AdminAccountPage() {
  const { role } = useAuth()
  if (role !== 'admin') return <div className="admin-denied">您沒有帳號管理權限</div>
  return <AuthorizedAdminAccountPage />
}

function AuthorizedAdminAccountPage() {
  const { user: currentUser } = useAuth()
  const { users, auditLogs, loading, mutation, errorCode, refresh, invite, changeRole, resend, resetPassword, remove } = useAdminUsers()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reloginNotice, setReloginNotice] = useState(false)
  const adminCount = users.filter(user => user.role === 'admin').length
  const invitedCount = users.filter(user => user.status === 'invited').length
  const deleteBusy = mutation === `delete:${deleteTarget?.id}`

  const submitInvite = async email => {
    await invite(email)
    setInviteOpen(false)
  }
  const submitDelete = async email => {
    if (await remove(deleteTarget.id, email)) setDeleteTarget(null)
  }
  const selectRole = async (target, role) => {
    if (!target.lastSignInAt || target.id === currentUser?.id || (target.role === 'admin' && adminCount <= 1)) return
    if (await changeRole(target.id, role)) setReloginNotice(true)
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>帳號管理</h1>
          <p>管理後台使用者、角色與操作紀錄。因為資料庫是Free Tier，所以幾小時內能新增的使用者有限。</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button className="btn-secondary" type="button" onClick={refresh} disabled={loading} aria-label="重新整理帳號列表">
            {loading ? '載入中…' : '重新整理'}
          </button>
          <button className="btn-primary" type="button" onClick={() => setInviteOpen(true)}>
            邀請帳號
          </button>
        </div>
      </div>
      {errorCode && (
        <div className="sql-alert error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{ERROR_MESSAGES[errorCode] || '帳號管理操作失敗，請稍後再試。'}</span>
          <button className="btn-secondary" type="button" onClick={refresh} style={{ marginLeft: '12px', padding: '4px 10px', fontSize: '12px' }}>
            重試連線
          </button>
        </div>
      )}
      {reloginNotice && <div className="sql-alert success">角色變更後，該使用者需要重新登入。</div>}
      <section className="admin-summary-grid" aria-label="帳號摘要">
        <div className="admin-summary-card"><span>全部帳號</span><strong className="admin-summary-value">{users.length}</strong></div>
        <div className="admin-summary-card"><span>管理員</span><strong className="admin-summary-value">{adminCount}</strong></div>
        <div className="admin-summary-card"><span>待接受邀請</span><strong className="admin-summary-value">{invitedCount}</strong></div>
      </section>
      {loading ? <p>載入帳號資料中…</p> : <div className="admin-user-table"><table className="data-table"><thead><tr><th>Email</th><th>角色</th><th>狀態</th><th>操作</th></tr></thead><tbody>
        {users.map(target => {
          // 此處 UI 保護用於避免明顯誤操作；實際資料完整性仍由資料庫 trigger 與 Edge Function 在伺服器端確保。
          // protectedUser 僅根據目前 session metadata 判斷，不能取代伺服器端的權限與完整性驗證。
          const protectedUser = target.id === currentUser?.id || (target.role === 'admin' && adminCount <= 1)
          const firstLoginRequired = !target.lastSignInAt
          return <tr key={target.id}><td>{target.email}</td><td><select className={`admin-role-select admin-role-select--${target.role}`} aria-label={`變更 ${target.email} 的角色`} value={target.role} disabled={firstLoginRequired || protectedUser || mutation === `role:${target.id}`} onChange={event => selectRole(target, event.target.value)}>{Object.entries(ROLE_LABELS).map(([role, label]) => <option key={role} value={role}>{label}</option>)}</select></td><td><span className={`admin-status-badge ${target.status}`}>{target.status === 'active' ? '啟用中' : '已邀請'}</span></td><td className="admin-actions">{target.status === 'invited' ? <button className="btn-secondary" type="button" disabled={mutation === `resend:${target.id}`} onClick={() => resend(target.id)} aria-label={`重新寄送邀請 ${target.email}`}>重新寄送邀請</button> : <button className="btn-secondary" type="button" disabled={mutation === `reset:${target.id}`} onClick={() => resetPassword(target.id)} aria-label={`寄送密碼重設 ${target.email}`}>寄送密碼重設</button>}<button className="btn-delete" type="button" disabled={protectedUser} onClick={() => setDeleteTarget(target)} aria-label={`刪除 ${target.email}`}>刪除</button></td></tr>
        })}
      </tbody></table></div>}
      <AdminAuditLog auditLogs={auditLogs} />
      {inviteOpen && <InviteUserModal open busy={mutation === 'invite'} onCancel={() => setInviteOpen(false)} onSubmit={submitInvite} />}
      <DeleteUserDialog user={deleteTarget} open={Boolean(deleteTarget)} busy={deleteBusy} onCancel={() => setDeleteTarget(null)} onConfirm={submitDelete} />
    </main>
  )
}
