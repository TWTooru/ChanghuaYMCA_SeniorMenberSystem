import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import '../common/common.css'

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
}

export default function ImportPreviewDialog({ preview, isImporting = false, onConfirm, onCancel }) {
  const { summary, studentResolutions = [], warnings = [], errors = [], hasBlockingErrors } = preview
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const confirmationDisabled = hasBlockingErrors || isImporting

  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const [initialFocus] = getFocusableElements(dialogRef.current)
    ;(initialFocus || dialogRef.current).focus()
    return () => previousFocusRef.current?.isConnected && previousFocusRef.current.focus()
  }, [])

  const handleKeyDown = event => {
    if (event.key !== 'Tab') return
    const focusable = getFocusableElements(dialogRef.current)
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }
  const resolutionText = resolution => {
    if (resolution.action === 'insert') return `第 ${resolution.sourceRow} 列：${resolution.studentName} → 新增並由系統指派編號`
    const details = [`依${resolution.matchedBy || '既有資料'}`]
    if (resolution.changedFields?.length) details.push(`變更：${resolution.changedFields.join('、')}`)
    return `第 ${resolution.sourceRow} 列：${resolution.studentName} → 更新會員 ${resolution.studentId}（${details.join('；')}）`
  }

  return createPortal(
    <div className="modal-overlay-center" onClick={onCancel}>
      <div className="form-modal-content import-preview-modal-content" ref={dialogRef} role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby="import-preview-title" onClick={event => event.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="modal-header-centered"><h2 id="import-preview-title">匯入會員預覽</h2></div>
        <div className="form-grid">
          <section className="form-group full-width" aria-label="本次會員匯入">
            <h3>本次會員匯入</h3>
            <ul>
              <li>檔案資料 {summary.fileRows} 列</li>
              <li>新增會員 {summary.newStudents} 位</li>
              <li>更新會員 {summary.updatedStudents} 位</li>
              <li>目前會員 {summary.currentStudents} 位</li>
            </ul>
          </section>
          {studentResolutions.length > 0 && <section className="form-group full-width" aria-label="會員比對結果"><h3>會員比對結果</h3><ul>{studentResolutions.map(resolution => <li key={resolution.sourceRow}>{resolutionText(resolution)}</li>)}</ul></section>}
          {warnings.length > 0 && <section className="form-group full-width" aria-label="提醒"><h3>提醒</h3><ul>{warnings.map((warning, index) => <li key={`${warning.row}-${warning.field}-${index}`}>{warning.row ? `第 ${warning.row} 列 · ` : ''}{warning.field ? `${warning.field}：` : ''}{warning.message}</li>)}</ul></section>}
          {errors.length > 0 && <section className="form-group full-width" aria-label="錯誤"><h3>錯誤</h3><ul>{errors.map((error, index) => <li key={`${error.row}-${error.field}-${index}`}>第 {error.row || '—'} 列 · {error.field || '資料'}：{error.message}</li>)}</ul></section>}
        </div>
        <div className="form-footer"><button type="button" className="btn-secondary" onClick={onCancel} disabled={isImporting}>取消</button><button type="button" className="btn-primary" onClick={onConfirm} disabled={confirmationDisabled}>確認匯入</button></div>
      </div>
    </div>, document.body
  )
}
