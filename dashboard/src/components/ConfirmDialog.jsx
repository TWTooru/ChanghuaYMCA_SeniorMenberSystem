import { AlertCircle } from 'lucide-react'

export default function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay-center" onClick={onCancel}>
      <div className="form-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-danger)', marginBottom: '16px' }} />
          <h3 style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>{title}</h3>
          <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
            <button type="button" className="btn-primary" onClick={onConfirm}
              style={{ backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}>
              確認刪除
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
