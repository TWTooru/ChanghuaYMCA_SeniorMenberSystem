import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import useBodyScrollLock from '../../hooks/useBodyScrollLock'
import '../common/common.css'

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(element => !element.hasAttribute('disabled'))
}

/**
 * 收集匯出範圍與工作表選項，將期別篩選結果交給上層匯出 hook。
 * 自行管理 focus trap，避免鍵盤焦點離開 modal。
 */
export default function ExportOptionsDialog({ 
  enrollments, 
  onExport, 
  onCancel 
}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  useBodyScrollLock(true)

  // 依期別字串排序產生清單，讓選項呈現順序固定。
  const periodsList = useMemo(() => {
    if (!enrollments) return []
    const set = new Set(enrollments.map(e => e.period).filter(Boolean))
    return Array.from(set).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [enrollments])

  const [exportScope, setExportScope] = useState('all') // 僅可選擇全部資料或單一期別。
  const [selectedPeriod, setSelectedPeriod] = useState(periodsList[0] || '')
  
  const [includeStats, setIncludeStats] = useState(true)
  const [includeStudents, setIncludeStudents] = useState(true)
  const [includeEnrollments, setIncludeEnrollments] = useState(true)
  const [includeCourses, setIncludeCourses] = useState(true)

  // focus trap 只在 dialog 存在期間處理鍵盤事件，關閉後不再攔截焦點。
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog).focus()
    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
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

  const canConfirm = includeStats || includeStudents || includeEnrollments || includeCourses

  const handleConfirm = () => {
    if (!canConfirm) return
    onExport({
      exportScope,
      selectedPeriod: exportScope === 'period' ? selectedPeriod : null,
      options: {
        includeStats,
        includeStudents,
        includeEnrollments,
        includeCourses
      }
    })
  }

  return createPortal(
    <div className="modal-overlay-center">
      <div 
        className="form-modal-content" 
        ref={dialogRef} 
        role="dialog" 
        tabIndex={-1} 
        aria-modal="true" 
        aria-labelledby="export-options-title"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{ maxWidth: '480px' }}
      >
        <div className="modal-header-centered">
          <h2 id="export-options-title">Excel 匯出設定</h2>
        </div>
        <div className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <section className="form-group" aria-label="資料範圍">
            <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '0 0 8px 0' }}>資料範圍</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="radio" 
                  name="exportScope" 
                  value="all" 
                  checked={exportScope === 'all'} 
                  onChange={() => setExportScope('all')} 
                />
                匯出全部歷史資料
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input 
                  type="radio" 
                  name="exportScope" 
                  value="period" 
                  checked={exportScope === 'period'} 
                  onChange={() => setExportScope('period')} 
                />
                依特定期別篩選
              </label>
            </div>
            {exportScope === 'period' && (
              <select 
                className="form-select" 
                value={selectedPeriod} 
                onChange={e => setSelectedPeriod(e.target.value)}
                style={{ marginTop: '8px', width: '100%' }}
              >
                {periodsList.map(period => (
                  <option key={period} value={period}>{period}</option>
                ))}
              </select>
            )}
          </section>

          <section className="form-group" aria-label="匯出分頁">
            <h3 style={{ fontSize: '14px', fontWeight: '600', margin: '12px 0 8px 0' }}>自訂匯出分頁 (Sheets)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={includeStats} onChange={e => setIncludeStats(e.target.checked)} />
                統計摘要
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={includeStudents} onChange={e => setIncludeStudents(e.target.checked)} />
                學員個人資料
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={includeEnrollments} onChange={e => setIncludeEnrollments(e.target.checked)} />
                報名明細紀錄
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                <input type="checkbox" checked={includeCourses} onChange={e => setIncludeCourses(e.target.checked)} />
                課程選修統計
              </label>
            </div>
          </section>
        </div>
        <div className="form-footer">
          <button type="button" className="btn-secondary" onClick={onCancel}>取消</button>
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={!canConfirm}>確認下載</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
