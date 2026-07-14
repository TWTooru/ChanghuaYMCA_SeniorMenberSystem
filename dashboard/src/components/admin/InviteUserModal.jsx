import { useState } from 'react'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function InviteUserModal({ open, busy, onCancel, onSubmit }) {
  const [email, setEmail] = useState('')
  if (!open) return null

  const validEmail = EMAIL_PATTERN.test(email.trim())
  const submit = event => {
    event.preventDefault()
    if (validEmail && !busy) onSubmit(email.trim())
  }

  return (
    <div className="modal-overlay-center" role="dialog" aria-modal="true" aria-label="邀請帳號">
      <form className="admin-modal" onSubmit={submit}>
        <div className="modal-header-centered"><h2>邀請帳號</h2></div>
        <div className="form-grid">
          <label className="form-group">Email
            <input className="form-input" type="email" value={email} onChange={event => setEmail(event.target.value)} />
          </label>
          <p>邀請的帳號預設為瀏覽者，你可以後續自行調整權限。</p>
        </div>
        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
          <button type="submit" className="btn-primary" disabled={!validEmail || busy}>送出邀請</button>
        </div>
      </form>
    </div>
  )
}
