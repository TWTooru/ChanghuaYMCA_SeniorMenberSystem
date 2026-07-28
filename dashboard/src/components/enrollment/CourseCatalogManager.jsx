import { useEffect, useRef, useState } from 'react'

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(element => !element.hasAttribute('disabled'))
}

export default function CourseCatalogManager({
  catalog,
  onSaveCourse,
  onDeactivateCourse,
  onClose,
  returnFocusRef,
}) {
  const [courseName, setCourseName] = useState('')
  const [confirmingCourse, setConfirmingCourse] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog).focus()

    return () => {
      const returnFocus = returnFocusRef?.current
      if (returnFocus?.isConnected) returnFocus.focus()
    }
  }, [returnFocusRef])

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

  const handleSave = async event => {
    event.preventDefault()
    if (pending) return

    setPending(true)
    setError('')
    try {
      await onSaveCourse(courseName)
      setCourseName('')
    } catch (saveError) {
      setError(saveError.message || '課程儲存失敗')
    } finally {
      setPending(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirmingCourse || pending) return

    setPending(true)
    setError('')
    try {
      await onDeactivateCourse(confirmingCourse)
      setConfirmingCourse(null)
    } catch (deactivateError) {
      setError(deactivateError.message || '課程停用失敗')
    } finally {
      setPending(false)
    }
  }

  return (
    <div
      ref={dialogRef}
      className="course-catalog-manager"
      role="dialog"
      tabIndex={-1}
      aria-modal="true"
      aria-labelledby="course-catalog-manager-title"
      onKeyDown={handleKeyDown}
    >
      <div className="course-catalog-manager-header">
        <h3 id="course-catalog-manager-title">管理課程</h3>
        <button type="button" className="btn-secondary course-catalog-close" onClick={onClose} disabled={pending}>
          關閉
        </button>
      </div>

      <form className="course-catalog-add-form" onSubmit={handleSave}>
        <label className="form-label" htmlFor="new-course-name">新增課程名稱</label>
        <div className="course-catalog-add-controls">
          <input
            id="new-course-name"
            className="form-input"
            value={courseName}
            onChange={event => setCourseName(event.target.value)}
            disabled={pending}
          />
          <button type="submit" className="btn-primary" disabled={pending}>
            {pending ? '處理中…' : '新增或重新啟用'}
          </button>
        </div>
      </form>

      {error && <p className="course-catalog-error" role="alert">{error}</p>}

      {confirmingCourse && (
        <div className="course-catalog-confirmation" role="status">
          <p>停用「{confirmingCourse.courseName}」不會刪除既有歷史資料。</p>
          <div className="course-catalog-confirmation-actions">
            <button type="button" className="btn-secondary" onClick={() => setConfirmingCourse(null)} disabled={pending}>
              取消
            </button>
            <button type="button" className="btn-danger" onClick={handleDeactivate} disabled={pending}>
              {pending ? '處理中…' : '確認停用'}
            </button>
          </div>
        </div>
      )}

      <div className="course-catalog-list" aria-label="課程名單">
        {catalog.map(course => (
          <div className="course-catalog-row" key={course.courseCatalogId}>
            <span>{course.courseName}</span>
            <div className="course-catalog-row-actions">
              <span className={course.active ? 'course-catalog-status active' : 'course-catalog-status inactive'}>
                {course.active ? '啟用中' : '已停用'}
              </span>
              {course.active && (
                <button
                  type="button"
                  className="btn-secondary course-catalog-deactivate"
                  onClick={() => setConfirmingCourse(course)}
                  disabled={pending}
                  aria-label={`停用 ${course.courseName}`}
                >
                  停用
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
