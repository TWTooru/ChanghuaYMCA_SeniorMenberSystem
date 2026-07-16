import { useEffect, useRef } from 'react'

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

  return (
    <div className="modal-overlay-center" onClick={onCancel}>
      <div className="form-modal-content" ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="import-preview-title" onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header-centered">
          <h2 id="import-preview-title">匯入預覽</h2>
        </div>
        <div className="form-grid">
          <section className="form-group full-width" aria-label="匯入摘要">
            <h3>本次匯入</h3>
            <ul>
              <li>檔案資料 {summary.fileRows} 列</li>
              <li>既有學生 {summary.oldStudents} 人</li>
              <li>新生 {summary.newStudents} 人</li>
              <li>新增報名 {summary.enrollmentsToInsert} 筆</li>
              <li>更新報名 {summary.enrollmentsToUpdate} 筆</li>
              <li>課程 {summary.courses} 筆</li>
            </ul>
          </section>
          <section className="form-group full-width" aria-label="目前資料庫筆數">
            <h3>目前資料庫</h3>
            <ul>
              <li>目前學員 {summary.currentStudents} 人</li>
              <li>目前報名 {summary.currentEnrollments} 筆</li>
              <li>目前課程 {summary.currentCourses} 筆</li>
            </ul>
          </section>
          {warnings.length > 0 && (
            <section className="form-group full-width" aria-label="提醒">
              <h3>提醒</h3>
              <ul>
                {warnings.map((warning, index) => (
                  <li key={`${warning.row}-${warning.field}-${index}`}>
                    {warning.field || '資料'}：{warning.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {errors.length > 0 && (
            <section className="form-group full-width" aria-label="錯誤">
              <h3>錯誤</h3>
              <ul>
                {preview.errors.map((error, index) => (
                  <li key={`${error.row}-${error.field}-${index}`}>
                    第 {error.row || '—'} 列 · {error.field || '資料'}：{error.message}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="form-footer full-width">
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={isImporting}>取消</button>
            <button type="button" className="btn-primary" onClick={onConfirm} disabled={confirmationDisabled}>確認匯入</button>
          </div>
        </div>
      </div>
    </div>
  )
}
