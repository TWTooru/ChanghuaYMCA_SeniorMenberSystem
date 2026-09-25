import { useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import useAdminUsers from '../../hooks/useAdminUsers'
import usePermissions from '../../hooks/usePermissions'
import AdminAuditLog from './AdminAuditLog'
import DeleteUserDialog from './DeleteUserDialog'
import InviteUserModal from './InviteUserModal'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import './admin.css'

/**
 * 帳號管理頁只負責降低誤操作；每個 admin-users 請求仍由 Edge Function 依資料庫角色重新授權。
 */
const ROLE_LABELS = {
  owner: '最高管理員',
  admin: '管理員',
  editor: '編輯者',
  viewer: '瀏覽者',
}
const VALID_TARGET_ROLES = new Set(Object.keys(ROLE_LABELS))
const VALID_ACTOR_ROLES = new Set(['owner', 'admin'])
const OWNER_ROLE_OPTIONS = ['owner', 'admin', 'editor', 'viewer']
const ADMIN_ROLE_OPTIONS = ['editor', 'viewer']
const ERROR_MESSAGES = {
  FIRST_LOGIN_REQUIRED: '受邀帳號必須先完成首次登入，之後才能變更角色。',
  UNAUTHENTICATED: '登入已逾期，請重新登入後再試。',
  FORBIDDEN: '您沒有執行帳號管理操作的權限。',
  INVALID_INPUT: '輸入資料格式不正確。',
  USER_EXISTS: '此 Email 已有帳號。',
  USER_NOT_FOUND: '找不到指定的帳號。',
  SELF_MUTATION_FORBIDDEN: '不能變更自己的角色或刪除自己的帳號。',
  EMAIL_CONFIRMATION_MISMATCH: '確認 Email 與目標帳號不一致。',
  EMAIL_RATE_LIMITED: '邀請信寄送額度已滿，帳號可能已建立，請稍後從列表重新寄送邀請。',
  SUPABASE_AUTH_ERROR: '帳號服務暫時無法使用，請稍後再試。',
  AUDIT_WRITE_ERROR: '無法寫入操作紀錄，操作未完成。',
  ROLE_NOT_ASSIGNED: '此帳號尚未設定有效角色，請由最高管理員修正資料。',
  OWNER_PROTECTED: '最高管理員帳號不可修改、重設或刪除。',
  ADMIN_TARGET_FORBIDDEN: '一般管理員不能操作其他管理員帳號。',
  OWNER_REQUIRED: '此操作僅限最高管理員。',
  ROLE_STORE_ERROR: '角色資料目前無法讀取或更新，請稍後重試。',
}

/**
 * 以資料庫提供的 actor/target id 與 role 唯一決定列級控制，未知角色一律 fail closed。
 */
function getAccountRowPolicy(actor, target) {
  const actorAllowed = Boolean(actor?.id) && VALID_ACTOR_ROLES.has(actor?.role)
  const targetRoleValid = VALID_TARGET_ROLES.has(target?.role)
  const self = Boolean(actor?.id) && actor.id === target?.id
  const targetIsOwner = target?.role === 'owner'
  const adminTargetingAdmin = actor?.role === 'admin' && target?.role === 'admin'
  // 非 owner 的 actor 不能操作 owner 行；owner actor 可以
  const nonOwnerActorTargetingOwner = targetIsOwner && actor?.role !== 'owner'
  const locked = !actorAllowed || !targetRoleValid || self || nonOwnerActorTargetingOwner || adminTargetingAdmin

  let lockMessage = null
  if (self) lockMessage = '目前登入帳號'
  else if (!targetRoleValid) lockMessage = '角色資料異常'
  else if (actor?.role === 'admin' && (targetIsOwner || target?.role === 'admin')) lockMessage = '僅最高管理員可管理'

  return {
    locked,
    lockMessage,
    roleLabel: targetRoleValid ? ROLE_LABELS[target.role] : '角色未設定',
    roleOptions: locked
      ? []
      : actor.role === 'owner'
        ? OWNER_ROLE_OPTIONS
        : ADMIN_ROLE_OPTIONS,
  }
}

export default function AdminAccountPage() {
  const { role, user } = useAuth()
  const permissions = usePermissions(role)
  const actor = { id: user?.id, role }

  if (!permissions.canManageUsers || !VALID_ACTOR_ROLES.has(role) || !actor.id) {
    return <div className="admin-denied">您沒有帳號管理權限</div>
  }

  return <AuthorizedAdminAccountPage actor={actor} />
}

function AuthorizedAdminAccountPage({ actor }) {
  const { users, auditLogs, loading, mutation, errorCode, refresh, invite, changeRole, resend, resetPassword, remove } = useAdminUsers()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [roleUpdateNotice, setRoleUpdateNotice] = useState(false)
  const invitedCount = users.filter(user => user.status === 'invited').length
  const deleteBusy = mutation === `delete:${deleteTarget?.id}`

  const submitInvite = async email => {
    await invite(email)
    setInviteOpen(false)
  }
  const submitDelete = async email => {
    if (await remove(deleteTarget.id, email)) setDeleteTarget(null)
  }
  const selectRole = async (target, nextRole) => {
    const policy = getAccountRowPolicy(actor, target)
    if (policy.locked || !target.lastSignInAt || !policy.roleOptions.includes(nextRole)) return

    setRoleUpdateNotice(false)
    if (await changeRole(target.id, nextRole)) setRoleUpdateNotice(true)
  }

  return (
    <main className="admin-page">
      <div className="admin-page-header">
        <div>
          <h1>帳號管理</h1>
          <p>管理後台使用者、角色與操作紀錄。因為資料庫是Free Tier，所以幾小時內能新增的使用者有限。</p>
        </div>
        <div className="admin-toolbar">
          <Button variant="outline" type="button" onClick={refresh} disabled={loading} aria-label="重新整理帳號列表">
            {loading ? '載入中…' : '重新整理'}
          </Button>
          <Button type="button" onClick={() => setInviteOpen(true)}>
            邀請帳號
          </Button>
        </div>
      </div>
      {errorCode && (
        <div className="sql-alert error" role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{ERROR_MESSAGES[errorCode] || '帳號管理操作失敗，請稍後再試。'}</span>
          <Button variant="outline" size="sm" type="button" onClick={refresh} style={{ marginLeft: '12px' }}>
            重試連線
          </Button>
        </div>
      )}
      {roleUpdateNotice && <div className="sql-alert success">角色權限已更新。</div>}
      <section className="admin-summary-grid" aria-label="帳號摘要">
        <Card className="gap-0 py-0 admin-summary-card"><span>全部帳號</span><strong className="admin-summary-value">{users.length}</strong></Card>
        <Card className="gap-0 py-0 admin-summary-card"><span>待接受邀請</span><strong className="admin-summary-value">{invitedCount}</strong></Card>
      </section>
      {loading ? <p>載入帳號資料中…</p> : <div className="admin-user-table"><Table className="data-table" aria-label="帳號列表"><TableHeader><TableRow><TableHead>Email</TableHead><TableHead>角色</TableHead><TableHead>狀態</TableHead><TableHead>操作</TableHead></TableRow></TableHeader><TableBody>
        {users.map(target => {
          const policy = getAccountRowPolicy(actor, target)
          const firstLoginRequired = !target.lastSignInAt
          return <TableRow key={target.id}>
            <TableCell>{target.email}</TableCell>
            <TableCell>
              {policy.locked
                ? <Badge variant="secondary" className={`admin-role-badge admin-role-badge--${VALID_TARGET_ROLES.has(target.role) ? target.role : 'missing'}`}>{policy.roleLabel}</Badge>
                : <Select
                    aria-label={`變更 ${target.email} 的角色`}
                    value={target.role}
                    items={ROLE_LABELS}
                    disabled={firstLoginRequired || mutation === `role:${target.id}`}
                    onValueChange={nextRole => selectRole(target, nextRole)}
                  >
                    <SelectTrigger size="sm" className={`admin-role-select admin-role-select--${target.role}`} aria-label={`變更 ${target.email} 的角色`}><SelectValue>{role => ROLE_LABELS[role] ?? role}</SelectValue></SelectTrigger>
                    <SelectContent>{policy.roleOptions.map(roleOption => <SelectItem key={roleOption} value={roleOption}>{ROLE_LABELS[roleOption]}</SelectItem>)}</SelectContent>
                  </Select>}
            </TableCell>
            <TableCell><Badge variant={target.status === 'active' ? 'default' : 'secondary'} className={`admin-status-badge ${target.status}`}>{target.status === 'active' ? '啟用中' : '已邀請'}</Badge></TableCell>
            <TableCell className="admin-actions">
              {policy.locked
                ? <span className="admin-lock-message">{policy.lockMessage}</span>
                : <>
                    {target.status === 'invited'
                      ? <Button variant="outline" type="button" disabled={mutation === `resend:${target.id}`} onClick={() => resend(target.id)} aria-label={`重新寄送邀請 ${target.email}`}>重新寄送邀請</Button>
                      : <Button variant="outline" type="button" disabled={mutation === `reset:${target.id}`} onClick={() => resetPassword(target.id)} aria-label={`寄送密碼重設 ${target.email}`}>寄送密碼重設</Button>}
                    <Button variant="destructive" type="button" disabled={mutation === `delete:${target.id}`} onClick={() => setDeleteTarget(target)} aria-label={`刪除 ${target.email}`}>刪除</Button>
                  </>}
            </TableCell>
          </TableRow>
        })}
      </TableBody></Table></div>}
      <AdminAuditLog auditLogs={auditLogs} />
      {inviteOpen && <InviteUserModal open busy={mutation === 'invite'} onCancel={() => setInviteOpen(false)} onSubmit={submitInvite} />}
      <DeleteUserDialog user={deleteTarget} open={Boolean(deleteTarget)} busy={deleteBusy} onCancel={() => setDeleteTarget(null)} onConfirm={submitDelete} />
    </main>
  )
}
