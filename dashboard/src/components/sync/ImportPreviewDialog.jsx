export default function ImportPreviewDialog({ preview, isImporting = false, onConfirm, onCancel }) {
  const { summary, warnings = [], errors = [], hasBlockingErrors } = preview
  const confirmationDisabled = hasBlockingErrors || isImporting

  return (
    <div className="modal-overlay-center" onClick={onCancel}>
      <div className="form-modal-content" role="dialog" aria-modal="true" aria-labelledby="import-preview-title" onClick={event => event.stopPropagation()}>
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
