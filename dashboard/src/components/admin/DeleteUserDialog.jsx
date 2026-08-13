import { useEffect, useState } from 'react'

/** 刪除前要求輸入目標 Email，降低不可復原操作因誤點或誤選造成的風險。 */
export default function DeleteUserDialog({ user, open, busy, onCancel, onConfirm }) {
  const [confirmation, setConfirmation] = useState('')
  useEffect(() => { setConfirmation('') }, [user?.id])
  if (!open || !user) return null

  const matches = confirmation.trim().toLowerCase() === user.email.trim().toLowerCase()
  return (
    <div className="modal-overlay-center" role="dialog" aria-modal="true" aria-label="永久刪除帳號">
      <div className="admin-modal">
        <div className="modal-header-centered"><h2>永久刪除帳號</h2></div>
        <div className="form-grid">
          <p className="admin-danger-copy">此操作無法復原。請輸入 {user.email} 以確認。</p>
          <label className="form-group full-width">輸入確認 Email
            <input className="form-input" value={confirmation} onChange={event => setConfirmation(event.target.value)} />
          </label>
        </div>
        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
          <button type="button" className="btn-delete" disabled={!matches || busy} onClick={() => onConfirm(confirmation)}>永久刪除</button>
        </div>
      </div>
    </div>
  )
}
