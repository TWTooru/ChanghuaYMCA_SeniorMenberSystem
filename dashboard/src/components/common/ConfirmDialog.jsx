import { useRef } from 'react'
import { AlertCircle } from 'lucide-react'
import useModalA11y from '../../hooks/useModalA11y'

/** 可重用的破壞性操作確認層；是否允許操作仍由呼叫端與後端決定。 */
function OpenConfirmDialog({ title, message, confirmLabel = '確認刪除', cancelLabel = '取消', tone = 'danger', onConfirm, onCancel }) {
  const modalRef = useRef(null)
  useModalA11y(modalRef, onCancel)

  return (
    <div className="modal-overlay-center">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="form-modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <AlertCircle size={48} style={{ color: tone === 'danger' ? 'var(--color-danger)' : undefined, marginBottom: '16px' }} />
          <h3 id="confirm-dialog-title" style={{ margin: '0 0 12px 0', color: 'var(--text-primary)' }}>{title}</h3>
          <p style={{ margin: '0 0 24px 0', color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button type="button" className="btn-secondary" onClick={onCancel}>{cancelLabel}</button>
            <button type="button" className="btn-primary" onClick={onConfirm}
              style={tone === 'danger' ? { backgroundColor: 'var(--color-danger)', borderColor: 'var(--color-danger)' } : undefined}>
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ConfirmDialog({ isOpen, ...props }) {
  return isOpen ? <OpenConfirmDialog {...props} /> : null
}
