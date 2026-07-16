import { useEffect, useRef, useState, useMemo } from 'react'
import { createPortal } from 'react-dom'

export default function ExportOptionsDialog({ 
  students: _students, 
  enrollments, 
  onExport, 
  onCancel 
}) {
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)

  // 1. Get unique sorted seasons list
  const seasonsList = useMemo(() => {
    if (!enrollments) return []
    const set = new Set(enrollments.map(e => e.season).filter(Boolean))
    return Array.from(set).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  }, [enrollments])

  // 2. States
  const [exportScope, setExportScope] = useState('all') // 'all' or 'season'
  const [selectedSeason, setSelectedSeason] = useState(seasonsList[0] || '')
  
  const [includeStats, setIncludeStats] = useState(true)
  const [includeStudents, setIncludeStudents] = useState(true)
  const [includeEnrollments, setIncludeEnrollments] = useState(true)
  const [includeCourses, setIncludeCourses] = useState(true)

  // 3. Focus Trap
  useEffect(() => {
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    if (dialog) dialog.focus()
    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [])

  const canConfirm = includeStats || includeStudents || includeEnrollments || includeCourses

  const handleConfirm = () => {
    if (!canConfirm) return
    onExport({
      exportScope,
      selectedSeason: exportScope === 'season' ? selectedSeason : null,
      options: {
        includeStats,
        includeStudents,
        includeEnrollments,
        includeCourses
      }
    })
  }

  return createPortal(
    <div className="modal-overlay-center" onClick={onCancel}>
      <div 
        className="form-modal-content" 
        ref={dialogRef} 
        role="dialog" 
        tabIndex={-1} 
        aria-modal="true" 
        aria-labelledby="export-options-title"
        onClick={e => e.stopPropagation()}
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
                  value="season" 
                  checked={exportScope === 'season'} 
                  onChange={() => setExportScope('season')} 
                />
                依特定季度篩選
              </label>
            </div>
            {exportScope === 'season' && (
              <select 
                className="form-select" 
                value={selectedSeason} 
                onChange={e => setSelectedSeason(e.target.value)}
                style={{ marginTop: '8px', width: '100%' }}
              >
                {seasonsList.map(season => (
                  <option key={season} value={season}>{season}</option>
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
