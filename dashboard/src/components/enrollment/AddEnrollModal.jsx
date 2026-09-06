import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabaseClient'
import { createEnrollmentForm } from '../../services/enrollmentService'
import { normalizePeriod, periodNumber } from '../../domain/period'
import useBodyScrollLock from '../../hooks/useBodyScrollLock'
import CourseTagPicker from './CourseTagPicker'
import '../common/common.css'

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => !element.hasAttribute('disabled'))
}

const initialEnrollmentState = (defaultPeriod = '第1期') => {
  const num = periodNumber(defaultPeriod)
  return {
    period: num > 0 ? String(num) : '',
    reg_type: '續',
    period_start_date: '',
    period_end_date: '',
    courses: [],
    prepaid_amount: '',
    prepaid_receipt_number: '',
    tuition_fee: '',
    materials_fee: '',
    membership_fee: '',
    fee_receipt_number: '',
    refunded: false,
    refund_info: '',
    notes: '',
    handled_by_name: '',
    reported_on: '',
  }
}

// 新增報名會連同課程與收據明細，以單一 `createEnrollmentForm` 請求原子儲存。
export default function AddEnrollModal({ student, enrollments = [], onClose, onRefresh, defaultPeriod = '第1期' }) {
  const { user } = useAuth()
  const [newEnroll, setNewEnroll] = useState(() => initialEnrollmentState(defaultPeriod))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const submitInFlightRef = useRef(false)
  const dialogRef = useRef(null)
  const previousFocusRef = useRef(null)
  const hasStudent = Boolean(student)
  useBodyScrollLock(hasStudent)

  const selectedPeriodName = normalizePeriod(newEnroll.period) || (newEnroll.period ? `第${newEnroll.period}期` : '')
  const existingEnrollment = selectedPeriodName
    ? enrollments.find(e => normalizePeriod(e.period) === selectedPeriodName)
    : null
  const isAppended = Boolean(existingEnrollment)
  const nextSequence = isAppended
    ? (existingEnrollment.forms?.length || existingEnrollment.formCount || 1) + 1
    : 1

  const effectiveStartDate = isAppended
    ? (existingEnrollment.period_start_date || '')
    : newEnroll.period_start_date
  const effectiveEndDate = isAppended
    ? (existingEnrollment.period_end_date || '')
    : newEnroll.period_end_date

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

  const handleChange = event => {
    const { name, value, type, checked } = event.target
    setNewEnroll(current => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleAddEnrollSubmit = async event => {
    event.preventDefault()
    if (!student || submitInFlightRef.current) return

    setSubmitError('')

    if (isAppended && existingEnrollment.courses?.length > 0) {
      const hasDuplicate = newEnroll.courses.some(c => existingEnrollment.courses.includes(c))
      if (hasDuplicate) {
        setSubmitError('同一期別內已有其他報名表包含相同的課程')
        return
      }
    }

    submitInFlightRef.current = true
    setIsSubmitting(true)
    let succeeded = false
    try {
      const payload = {
        ...newEnroll,
        period: selectedPeriodName || newEnroll.period,
        period_start_date: effectiveStartDate,
        period_end_date: effectiveEndDate,
        reported_on: newEnroll.reported_on || null,
      }
      await createEnrollmentForm(supabase, student.student_id, payload)
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
      id="modal-add-enrollment-overlay"
    >
      <div
        className="form-modal-content"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
        aria-modal="true"
        aria-labelledby="add-enrollment-title"
        aria-describedby="add-enrollment-description"
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
        <p id="add-enrollment-description" className="visually-hidden">新增選課紀錄表單。</p>
        <form onSubmit={handleAddEnrollSubmit} className="form-grid add-enrollment-form">
          <div className="form-group">
            <label className="form-label" htmlFor="add-enrollment-student-name">學員姓名</label>
            <input
              id="add-enrollment-student-name"
              type="text"
              className="form-input"
              value={student.name}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="add-enrollment-student-id">學員 ID</label>
            <input
              id="add-enrollment-student-id"
              type="text"
              className="form-input"
              value={student.student_id}
              disabled
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>

          <fieldset className="member-wizard-section">
            <legend>報名資料</legend>
            <div className="member-wizard-section-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-period">修課期別 *</label>
                <div className="period-input-group">
                  <span className="period-prefix">第</span>
                  <input
                    id="add-enrollment-period"
                    name="period"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className="form-input period-number-input"
                    value={newEnroll.period}
                    disabled={isSubmitting}
                    onChange={handleChange}
                    required
                    placeholder="16"
                  />
                  <span className="period-suffix">期</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-registration-type">新/續生</label>
                <select
                  id="add-enrollment-registration-type"
                  name="reg_type"
                  className="form-select"
                  value={newEnroll.reg_type}
                  disabled={isSubmitting}
                  onChange={handleChange}
                >
                  <option value="新">新</option>
                  <option value="續">續</option>
                </select>
              </div>

              {isAppended && (
                <div className="append-notice full-width" role="status" style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'var(--bg-secondary, #f1f5f9)', borderRadius: '8px', borderLeft: '4px solid var(--color-accent, #6366f1)', marginBottom: '8px' }}>
                  <p className="append-notice-title" style={{ margin: 0, fontWeight: 600 }}>已有本期報名，將新增第 {nextSequence} 張報名表</p>
                  {existingEnrollment.courses?.length > 0 && (
                    <p className="append-notice-courses" style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary, #64748b)' }}>
                      既有課程：{existingEnrollment.courses.join('、')}
                    </p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-start-date">開始日期 *</label>
                <input
                  id="add-enrollment-start-date"
                  name="period_start_date"
                  type="date"
                  className="form-input"
                  value={effectiveStartDate}
                  disabled={isSubmitting || isAppended}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-end-date">結束日期 *</label>
                <input
                  id="add-enrollment-end-date"
                  name="period_end_date"
                  type="date"
                  className="form-input"
                  value={effectiveEndDate}
                  disabled={isSubmitting || isAppended}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-group full-width">
                <span className="form-label">選修課程 *</span>
                <CourseTagPicker
                  selectedCourseNames={newEnroll.courses}
                  lockedCourseNames={existingEnrollment?.courses || []}
                  disabled={isSubmitting}
                  onChange={courses => setNewEnroll(current => ({
                    ...current,
                    courses,
                  }))}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="member-wizard-section">
            <legend>預繳</legend>
            <div className="member-wizard-section-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-prepaid-amount">預繳金額</label>
                <input
                  id="add-enrollment-prepaid-amount"
                  name="prepaid_amount"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className="form-input"
                  value={newEnroll.prepaid_amount}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-prepaid-no">預繳 No.</label>
                <input
                  id="add-enrollment-prepaid-no"
                  name="prepaid_receipt_number"
                  type="text"
                  className="form-input"
                  value={newEnroll.prepaid_receipt_number}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="member-wizard-section">
            <legend>正式收據</legend>
            <div className="member-wizard-section-grid">
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-tuition-fee">學費</label>
                <input
                  id="add-enrollment-tuition-fee"
                  name="tuition_fee"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className="form-input"
                  value={newEnroll.tuition_fee}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-materials-fee">教材費</label>
                <input
                  id="add-enrollment-materials-fee"
                  name="materials_fee"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className="form-input"
                  value={newEnroll.materials_fee}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-membership-fee">會友費</label>
                <input
                  id="add-enrollment-membership-fee"
                  name="membership_fee"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className="form-input"
                  value={newEnroll.membership_fee}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-fee-no">正式收據 No.</label>
                <input
                  id="add-enrollment-fee-no"
                  name="fee_receipt_number"
                  type="text"
                  className="form-input"
                  value={newEnroll.fee_receipt_number}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>

          <fieldset className="member-wizard-section">
            <legend>退費狀態</legend>
            <div className="member-wizard-section-grid">
              <div className="form-group form-checkbox-group">
                <input
                  type="checkbox"
                  className="form-checkbox"
                  id="add-enrollment-refunded"
                  name="refunded"
                  checked={newEnroll.refunded}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
                <label className="form-label" htmlFor="add-enrollment-refunded" style={{ cursor: 'pointer' }}>是否已退費</label>
              </div>
              {newEnroll.refunded && (
                <div className="form-group">
                  <label className="form-label" htmlFor="add-enrollment-refund-notes">退費原因/備註</label>
                  <input
                    id="add-enrollment-refund-notes"
                    name="refund_info"
                    type="text"
                    className="form-input"
                    value={newEnroll.refund_info}
                    disabled={isSubmitting}
                    onChange={handleChange}
                    placeholder="例如: 因身體不適退費"
                  />
                </div>
              )}
            </div>
          </fieldset>

          <fieldset className="member-wizard-section">
            <legend>其他資料</legend>
            <div className="member-wizard-section-grid">
              <div className="form-group full-width">
                <label className="form-label" htmlFor="add-enrollment-notes">備註</label>
                <textarea
                  id="add-enrollment-notes"
                  name="notes"
                  className="form-input form-textarea"
                  rows={3}
                  value={newEnroll.notes}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-handled-by">經手人姓名</label>
                <input
                  id="add-enrollment-handled-by"
                  name="handled_by_name"
                  type="text"
                  className="form-input"
                  value={newEnroll.handled_by_name}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-account">登入帳號（自動帶入）</label>
                <input
                  id="add-enrollment-account"
                  className="form-input"
                  value={user?.email || ''}
                  readOnly
                  aria-readonly="true"
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-reported-on">報到日期</label>
                <input
                  id="add-enrollment-reported-on"
                  name="reported_on"
                  type="date"
                  className="form-input"
                  value={newEnroll.reported_on}
                  disabled={isSubmitting}
                  onChange={handleChange}
                />
              </div>
            </div>
          </fieldset>

          {submitError && <div role="alert" className="full-width" style={{ color: 'var(--danger)' }}>{submitError}</div>}
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
