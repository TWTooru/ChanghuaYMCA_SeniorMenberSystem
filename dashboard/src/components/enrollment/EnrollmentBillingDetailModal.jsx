import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabaseClient'
import {
  createCourseReceipt,
  updateCourseReceipt,
} from '../../services/courseReceiptService'
import StudentInfoView from '../students/StudentInfoView'
import './enrollmentBillingDetail.css'

const DUPLICATE_RECEIPT_ERROR = '此課程已有收據，請重新整理後再編輯'
const MISSING_COURSE_ID_ERROR = '課程資料已更新，請重新載入後再試'

function isValidId(value) {
  return Number.isSafeInteger(value) && value > 0
}

function displayAmount(amount) {
  return amount == null || String(amount).trim() === '' ? '--' : `NT$ ${amount}`
}

function displayInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber ?? '').trim() || '--'
}

export default function EnrollmentBillingDetailModal({
  student,
  enrollment,
  onClose,
  onRefresh,
}) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const enrollmentId = enrollment?.enrollment_id
  const [editor, setEditor] = useState(null)
  const [showCourseOptions, setShowCourseOptions] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saveInFlight = useRef(false)

  useEffect(() => {
    if (enrollmentId == null) return
    setEditor(null)
    setShowCourseOptions(false)
    setIsSaving(false)
    setError('')
    setSuccess('')
  }, [enrollmentId])

  if (!student || !enrollment) return null

  const courses = enrollment.courses || []
  const courseDetails = enrollment.courseDetails || []
  const existingReceipts = courseDetails.filter(course => course.receipt)
  const availableCourses = courseDetails.filter(course => !course.receipt)
  const hasLegacyBilling =
    enrollment.amount != null || Boolean(String(enrollment.invoice_number ?? '').trim())

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const toggleCourseOptions = () => {
    if (saveInFlight.current || availableCourses.length === 0) return
    setEditor(null)
    setShowCourseOptions(current => !current)
    clearMessages()
  }

  const startCreatingReceipt = course => {
    if (saveInFlight.current) return
    clearMessages()
    if (!isValidId(course.courseId)) {
      setError(MISSING_COURSE_ID_ERROR)
      return
    }

    setEditor({
      mode: 'create',
      courseId: course.courseId,
      courseName: course.courseName,
      receiptId: null,
      amount: '',
      invoiceNumber: '',
    })
    setShowCourseOptions(false)
  }

  const startEditingReceipt = course => {
    if (saveInFlight.current) return
    if (!isValidId(course.receipt?.receiptId)) {
      setError(MISSING_COURSE_ID_ERROR)
      return
    }

    setEditor({
      mode: 'edit',
      courseId: course.courseId,
      courseName: course.courseName,
      receiptId: course.receipt.receiptId,
      amount: course.receipt.amount == null ? '' : String(course.receipt.amount),
      invoiceNumber: course.receipt.invoiceNumber || '',
    })
    setShowCourseOptions(false)
    clearMessages()
  }

  const updateEditor = field => event => {
    const { value } = event.target
    setEditor(current => current ? { ...current, [field]: value } : current)
  }

  const handleSave = async event => {
    event.preventDefault()
    if (!permissions.canEditEnrollment || !editor || saveInFlight.current) return

    const targetId = editor.mode === 'create' ? editor.courseId : editor.receiptId
    if (!isValidId(targetId)) {
      setError(MISSING_COURSE_ID_ERROR)
      return
    }

    saveInFlight.current = true
    setIsSaving(true)
    clearMessages()
    try {
      const billing = {
        amount: editor.amount,
        invoice_number: editor.invoiceNumber,
      }
      const saved = editor.mode === 'create'
        ? await createCourseReceipt(supabase, editor.courseId, billing)
        : await updateCourseReceipt(supabase, editor.receiptId, billing)

      setEditor(current => current ? {
        ...current,
        receiptId: saved.receiptId,
        amount: saved.amount == null ? '' : String(saved.amount),
        invoiceNumber: saved.invoiceNumber || '',
      } : current)
      setSuccess('收據已儲存')
      onRefresh?.()
      setEditor(null)
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '收據儲存失敗'
      setError(message)
      if (message === DUPLICATE_RECEIPT_ERROR) onRefresh?.()
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-overlay enrollment-billing-overlay" onClick={onClose}>
      <div
        className="modal-content enrollment-billing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-billing-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="enrollment-billing-title">帳單明細</h2>
            <p className="enrollment-billing-subtitle">
              {student.name} · {enrollment.season}
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close enrollment billing details">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body enrollment-billing-body">
          {courses.length > 0 && (
            <section className="enrollment-billing-context" aria-label="選課資訊">
              <div className="timeline-courses">
                {courses.map((course, index) => (
                  <span className="course-tag" key={`${course}-${index}`}>{course}</span>
                ))}
              </div>
            </section>
          )}

          <section className="enrollment-billing-receipts" aria-labelledby="course-receipts-title">
            <div className="enrollment-billing-heading">
              <h3 id="course-receipts-title">課程收據</h3>
              <span className={`badge ${enrollment.refunded ? 'danger' : 'success'}`}>
                {enrollment.refunded ? '退費' : '正常'}
              </span>
            </div>

            <div className="course-receipt-list">
              {existingReceipts.length === 0 && (
                <p className="course-receipt-empty">尚未建立課程收據</p>
              )}
              {existingReceipts.map((course, index) => (
                <article
                  className="course-receipt-row"
                  key={course.receipt.receiptId ?? course.courseId ?? `${course.courseName}-${index}`}
                >
                  <strong>{course.courseName}</strong>
                  <div className="course-receipt-values">
                    <span>
                      <span className="course-receipt-label">金額</span>
                      {displayAmount(course.receipt.amount)}
                    </span>
                    <span>
                      <span className="course-receipt-label">發票編號</span>
                      {displayInvoiceNumber(course.receipt.invoiceNumber)}
                    </span>
                  </div>
                  {permissions.canEditEnrollment && (
                    <button
                      type="button"
                      className="btn-secondary course-receipt-edit"
                      disabled={isSaving}
                      onClick={() => startEditingReceipt(course)}
                    >
                      編輯
                    </button>
                  )}
                </article>
              ))}
            </div>

            {permissions.canEditEnrollment && (
              <div className="enrollment-billing-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  aria-controls="course-receipt-course-options"
                  aria-expanded={showCourseOptions}
                  disabled={isSaving || availableCourses.length === 0}
                  onClick={toggleCourseOptions}
                >
                  {availableCourses.length === 0 ? '所有課程都已建立收據' : '新增收據'}
                </button>
              </div>
            )}

            {permissions.canEditEnrollment && showCourseOptions && (
              <div
                id="course-receipt-course-options"
                className="course-receipt-course-options"
                aria-label="可建立收據的課程"
              >
                {availableCourses.map((course, index) => (
                  <button
                    type="button"
                    className="course-receipt-course-option"
                    key={course.courseId ?? `${course.courseName}-${index}`}
                    disabled={isSaving}
                    onClick={() => startCreatingReceipt(course)}
                  >
                    {course.courseName}
                  </button>
                ))}
              </div>
            )}

            {permissions.canEditEnrollment && editor && (
              <form className="course-receipt-editor" onSubmit={handleSave}>
                <h4>{editor.courseName}</h4>
                <div className="enrollment-billing-fields">
                  <div className="form-group">
                    <label className="form-label" htmlFor="course-receipt-amount">金額</label>
                    <input
                      id="course-receipt-amount"
                      className="form-input"
                      inputMode="numeric"
                      value={editor.amount}
                      onChange={updateEditor('amount')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="course-receipt-invoice-number">發票編號</label>
                    <input
                      id="course-receipt-invoice-number"
                      className="form-input"
                      value={editor.invoiceNumber}
                      onChange={updateEditor('invoiceNumber')}
                    />
                  </div>
                </div>
                <div className="enrollment-billing-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={isSaving}
                    onClick={() => setEditor(null)}
                  >
                    取消
                  </button>
                  <button type="submit" className="btn-primary" disabled={isSaving}>
                    {isSaving ? '儲存中…' : '儲存收據'}
                  </button>
                </div>
              </form>
            )}

            {error && <p className="enrollment-billing-message error" role="alert">{error}</p>}
            {success && <p className="enrollment-billing-message success">{success}</p>}
          </section>

          {hasLegacyBilling && (
            <section className="enrollment-legacy-billing" aria-labelledby="legacy-billing-title">
              <h3 id="legacy-billing-title">舊制帳單</h3>
              <div className="course-receipt-values">
                <span>
                  <span className="course-receipt-label">金額</span>
                  {displayAmount(enrollment.amount)}
                </span>
                <span>
                  <span className="course-receipt-label">發票編號</span>
                  {displayInvoiceNumber(enrollment.invoice_number)}
                </span>
              </div>
            </section>
          )}

          <section className="enrollment-billing-student" aria-label="學員資訊">
            <StudentInfoView student={student} />
          </section>
        </div>
      </div>
    </div>
  )
}
