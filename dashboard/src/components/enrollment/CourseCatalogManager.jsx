import { useEffect, useRef, useState } from 'react'

// 對話框開啟時將焦點留在可互動項目中，關閉後還原至 `returnFocusRef`，避免 `pending` 狀態讓鍵盤焦點遺失。
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
  disabled = false,
}) {
  const [courseName, setCourseName] = useState('')
  const [confirmingCourse, setConfirmingCourse] = useState(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const dialogRef = useRef(null)
  const controlsDisabled = pending || disabled

  useEffect(() => {
    const dialog = dialogRef.current
    const returnFocus = returnFocusRef?.current
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog).focus()

    return () => {
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
    event?.preventDefault()
    event?.stopPropagation()
    if (controlsDisabled) return

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
    if (!confirmingCourse || controlsDisabled) return

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
        <button type="button" className="btn-secondary course-catalog-close" onClick={onClose} disabled={controlsDisabled}>
          關閉
        </button>
      </div>

      <div className="course-catalog-add-form">
        <label className="form-label" htmlFor="new-course-name">新增課程名稱</label>
        <div className="course-catalog-add-controls">
          <input
            id="new-course-name"
            className="form-input"
            value={courseName}
            onChange={event => setCourseName(event.target.value)}
            onKeyDown={event => {
              if (event.key === 'Enter') handleSave(event)
            }}
            disabled={controlsDisabled}
          />
          <button type="button" className="btn-primary" onClick={handleSave} disabled={controlsDisabled}>
            {pending ? '處理中…' : '新增或重新啟用'}
          </button>
        </div>
      </div>

      {error && <p className="course-catalog-error" role="alert">{error}</p>}

      {confirmingCourse && (
        <div className="course-catalog-confirmation" role="status">
          <p>停用「{confirmingCourse.courseName}」不會刪除既有歷史資料。</p>
          <div className="course-catalog-confirmation-actions">
            <button type="button" className="btn-secondary" onClick={() => setConfirmingCourse(null)} disabled={controlsDisabled}>
              取消
            </button>
            <button type="button" className="btn-danger" onClick={handleDeactivate} disabled={controlsDisabled}>
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
                  disabled={controlsDisabled}
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
