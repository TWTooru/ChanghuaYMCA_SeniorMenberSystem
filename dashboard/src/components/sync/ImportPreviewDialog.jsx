import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'


function getFocusableElements(container) {
  return Array.from(container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(element => !element.hasAttribute('disabled'))
}

export default function ImportPreviewDialog({ preview, isImporting = false, onConfirm, onCancel }) {
  const { summary, warnings = [], errors = [], hasBlockingErrors } = preview
  const confirmationDisabled = hasBlockingErrors || isImporting
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog).focus()

    return () => {
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  const handleKeyDown = event => {
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    const focusableElements = getFocusableElements(dialog)
    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  // Process warnings
  const displayWarnings = []
  
  warnings.forEach(w => {
    const msg = w.message || ''
    const fieldPrefix = w.field ? `${w.field}：` : ''
    if (msg.includes('請確認新增與更新筆數')) {
      displayWarnings.push(`${fieldPrefix}請確認新增與更新筆數資料，一次僅能夠輸入一季報表，並確認檔案格式為.csv`)
    } else if (msg.includes('目標季度已有資料') || msg.includes('本次會更新並取代課程')) {
      displayWarnings.push(`${fieldPrefix}本次會更新並取代課程`)
    } else {
      displayWarnings.push(`${fieldPrefix}${msg}`)
    }
  })

  // If there's no database empty check warning, add the general reminder at the beginning
  if (!warnings.some(w => w.message.includes('請確認新增與更新筆數'))) {
    displayWarnings.unshift('請確認新增與更新筆數資料，一次僅能夠輸入一季報表，並確認檔案格式為.csv')
  }

  return createPortal(
    <div className="modal-overlay-center" onClick={onCancel}>
      <div className="form-modal-content" ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="import-preview-title" onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header-centered">
          <h2 id="import-preview-title">匯入預覽</h2>
        </div>
        <div className="form-grid">
          {displayWarnings.length > 0 && (
            <section 
              className="form-group full-width" 
              aria-label="提醒"
              style={{
                background: 'rgba(245, 158, 11, 0.08)',
                border: '1.5px solid var(--color-warning)',
                padding: '16px',
                borderRadius: '12px',
                color: '#fcd34d',
              }}
            >
              <h3 style={{ color: 'var(--color-warning)', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0' }}>
                ⚠️ 提醒
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {displayWarnings.map((msg, index) => (
                  <li key={index} style={{ fontSize: '14px', lineHeight: '1.5', fontWeight: '500' }}>
                    {msg}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="form-group full-width" aria-label="本次匯入">
            <h3 style={{ fontSize: '15px', fontWeight: '700', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', margin: '8px 0 4px 0' }}>
              本次匯入
            </h3>
            <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <li style={{ fontSize: '14px' }}>新增報名 {summary.enrollmentsToInsert} 筆</li>
              <li style={{ fontSize: '14px' }}>更新報名 {summary.enrollmentsToUpdate} 筆</li>
              <li style={{ fontSize: '14px' }}>課程 {summary.courses} 筆</li>
            </ul>
          </section>

          {errors.length > 0 && (
            <section 
              className="form-group full-width" 
              aria-label="錯誤"
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid var(--color-danger)',
                padding: '16px',
                borderRadius: '12px',
                color: '#fca5a5'
              }}
            >
              <h3 style={{ color: 'var(--color-danger)', fontWeight: '700', fontSize: '15px', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 8px 0' }}>
                ❌ 錯誤
              </h3>
              <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {preview.errors.map((error, index) => (
                  <li key={`${error.row}-${error.field}-${index}`} style={{ fontSize: '14px', lineHeight: '1.5' }}>
                    第 {error.row || '—'} 列 · {error.field || '資料'}：{error.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={isImporting}>取消</button>
          <button type="button" className="btn-primary" onClick={onConfirm} disabled={confirmationDisabled}>確認匯入</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
