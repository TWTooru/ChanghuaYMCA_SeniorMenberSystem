const ACTION_LABELS = {
  invite_user: '邀請帳號', update_role: '變更角色', delete_user: '刪除帳號',
  resend_invite: '重寄邀請', send_password_reset: '寄送密碼重設',
}
const STATUS_LABELS = { pending: '處理中', success: '成功', failure: '失敗' }

export default function AdminAuditLog({ auditLogs }) {
  return (
    <section className="admin-audit-list" aria-label="管理操作紀錄">
      <h2>管理操作紀錄</h2>
      {auditLogs.length === 0 ? <p className="table-cell-muted">目前沒有操作紀錄。</p> : auditLogs.map(log => (
        <article className="admin-audit-item" key={log.id}>
          <strong>{ACTION_LABELS[log.action] || log.action}</strong>
          <span className={`admin-status-badge ${log.status}`}>{STATUS_LABELS[log.status] || log.status}</span>
          <span>{log.actorEmail || '已刪除的帳號'}</span><span>→</span><span>{log.targetEmail || '已刪除的帳號'}</span>
          {(log.oldRole || log.newRole) && <span>{log.oldRole || '—'} → {log.newRole || '—'}</span>}
          <time dateTime={log.createdAt}>{new Date(log.createdAt).toLocaleString()}</time>
        </article>
      ))}
    </section>
  )
}
