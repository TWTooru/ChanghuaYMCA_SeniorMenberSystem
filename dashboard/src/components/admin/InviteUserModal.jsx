import { useState } from 'react'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteUserModal({ open, busy, onCancel, onSubmit }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('viewer')
  if (!open) return null

  const validEmail = EMAIL_PATTERN.test(email.trim())
  const submit = event => {
    event.preventDefault()
    if (validEmail && !busy) onSubmit(email.trim(), role)
  }

  return (
    <div className="modal-overlay-center" role="dialog" aria-modal="true" aria-label="邀請帳號">
      <form className="admin-modal" onSubmit={submit}>
        <div className="modal-header-centered"><h2>邀請帳號</h2></div>
        <div className="form-grid">
          <label className="form-group">Email
            <input className="form-input" type="email" value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <label className="form-group">角色
            <select className="form-select" value={role} onChange={event => setRole(event.target.value)}>
              <option value="viewer">瀏覽者</option><option value="editor">編輯者</option><option value="admin">管理員</option>
            </select>
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
          <button type="submit" className="btn-primary" disabled={!validEmail || busy}>送出邀請</button>
        </div>
      </form>
    </div>
  )
}
