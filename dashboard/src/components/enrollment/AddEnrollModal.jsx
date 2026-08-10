import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { createEnrollmentWithCourses } from '../../services/enrollmentService'
import { normalizeSeason } from '../../domain/season'
import { normalizePaymentRecords, reconcilePaymentRecords } from '../../domain/enrollmentPayments'
import CourseTagPicker from './CourseTagPicker'
import PaymentRecordsEditor from './PaymentRecordsEditor'
import '../common/common.css'

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.hasAttribute('disabled'))
}

// 新增報名會連同課程與繳費紀錄，以單一 `createEnrollmentWithCourses` 請求原子儲存。
export default function AddEnrollModal({ student, onClose, onRefresh, defaultSeason = '第十五季' }) {
  const [newEnroll, setNewEnroll] = useState({
    season: defaultSeason,
    reg_type: '續',
    pre_test: '',
    post_test: '',
    refunded: false,
    refund_info: '',
    courses: [],
    paymentRecords: [],
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitInFlightRef = useRef(false)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const hasStudent = Boolean(student)

  useEffect(() => {
    if (!hasStudent) return undefined
    previousFocusRef.current = document.activeElement
    const dialog = dialogRef.current
    const [initialFocus] = getFocusableElements(dialog)
    ;(initialFocus || dialog)?.focus()

    return () => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus()
    }
  }, [hasStudent])

  const handleAddEnrollSubmit = async event => {
    event.preventDefault()
    if (!student || submitInFlightRef.current) return

    setSubmitError('')
    const season = normalizeSeason(newEnroll.season)
    if (!season) {
      setSubmitError('請輸入有效的季度，例如：第十六季')
      return
    }
    if (newEnroll.courses.length === 0) {
      setSubmitError('請至少選擇一門課程')
      return
    }

    try {
      normalizePaymentRecords(newEnroll.paymentRecords, newEnroll.courses)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '繳費資料格式不正確')
      return
    }

    submitInFlightRef.current = true
    setIsSubmitting(true)
    let succeeded = false
    try {
      await createEnrollmentWithCourses(supabase, student.student_id, { ...newEnroll, season })
      succeeded = true
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '新增選課失敗')
    } finally {
      submitInFlightRef.current = false
      setIsSubmitting(false)
    }

    if (succeeded) {
      onRefresh?.()
      onClose()
    }
  }

  const handleKeyDown = event => {
    if (event.key === 'Escape') {
      if (!isSubmitting) onClose()
      return
    }
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    const focusableElements = getFocusableElements(dialog)
    if (focusableElements.length === 0) {
      event.preventDefault()
      dialog?.focus()
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

  if (!student) return null

  return (
    <div
      className="modal-overlay-center"
      onClick={isSubmitting ? undefined : onClose}
      id="modal-add-enrollment-overlay"
    >
      <div
        className="form-modal-content"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="add-enrollment-title"
        onClick={event => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header-centered">
          <h2 id="add-enrollment-title">新增選課紀錄</h2>
          <button
            type="button"
            className="btn-close"
            onClick={isSubmitting ? undefined : onClose}
            disabled={isSubmitting}
            aria-label="關閉新增選課"
            id="btn-close-add-enrollment"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleAddEnrollSubmit} className="form-grid">
          <div className="form-group">
            <label className="form-label">學員姓名</label>
            <input
              type="text"
              className="form-input"
              value={student.name}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">學員 ID</label>
            <input
              type="text"
              className="form-input"
              value={student.student_id}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="enrollment-season">修課季度 *</label>
            <input
              id="enrollment-season"
              type="text"
              className="form-input"
              value={newEnroll.season}
              onChange={event => setNewEnroll(current => ({ ...current, season: event.target.value }))}
              required
              placeholder="例如：第十六季"
            />
          </div>
          <div className="form-group">
            <label className="form-label">新/續生</label>
            <select
              className="form-select"
              value={newEnroll.reg_type}
              onChange={event => setNewEnroll(current => ({ ...current, reg_type: event.target.value }))}
            >
              <option value="新">新</option>
              <option value="續">續</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">前測分數</label>
            <input
              type="text"
              className="form-input"
              value={newEnroll.pre_test}
              onChange={event => setNewEnroll(current => ({ ...current, pre_test: event.target.value }))}
              placeholder="(分數)(年/月/日)"
            />
          </div>
          <div className="form-group">
            <label className="form-label">後測分數</label>
            <input
              type="text"
              className="form-input"
              value={newEnroll.post_test}
              onChange={event => setNewEnroll(current => ({ ...current, post_test: event.target.value }))}
              placeholder="(分數)(年/月/日)"
            />
          </div>
          <div className="form-group full-width">
            <span className="form-label">選修課程 *</span>
            <CourseTagPicker
              selectedCourseNames={newEnroll.courses}
              lockedCourseNames={[]}
              onChange={courses => setNewEnroll(current => ({
                ...current,
                courses,
                paymentRecords: reconcilePaymentRecords(current.paymentRecords, courses),
              }))}
            />
          </div>
          <div className="form-group full-width">
            <PaymentRecordsEditor
              selectedCourseNames={newEnroll.courses}
              records={newEnroll.paymentRecords}
              onChange={paymentRecords => setNewEnroll(current => ({ ...current, paymentRecords }))}
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group form-checkbox-group">
            <input
              type="checkbox"
              className="form-checkbox"
              id="refunded-checkbox"
              checked={newEnroll.refunded}
              onChange={event => setNewEnroll(current => ({ ...current, refunded: event.target.checked }))}
            />
            <label className="form-label" htmlFor="refunded-checkbox" style={{ cursor: 'pointer' }}>是否已退費</label>
          </div>
          <div className="form-group">
            {newEnroll.refunded && (
              <>
                <label className="form-label">退費原因/備註</label>
                <input
                  type="text"
                  className="form-input"
                  value={newEnroll.refund_info}
                  onChange={event => setNewEnroll(current => ({ ...current, refund_info: event.target.value }))}
                  placeholder="例如: 因身體不適退費"
                />
              </>
            )}
          </div>
          {submitError && <div role="alert" className="full-width">{submitError}</div>}
          <div className="form-footer full-width">
            <button
              type="button"
              className="btn-secondary"
              onClick={isSubmitting ? undefined : onClose}
              disabled={isSubmitting}
            >
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={isSubmitting}>
              新增選課
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
