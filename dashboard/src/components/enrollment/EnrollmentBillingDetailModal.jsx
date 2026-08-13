import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { normalizePaymentAmount } from '../../domain/enrollmentPayments'
import usePermissions from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabaseClient'
import {
  createBillingReceipt,
  deleteBillingReceipt,
  updateBillingReceipt,
} from '../../services/billingReceiptService'
import { updateEnrollmentRefundStatus } from '../../services/enrollmentService'
import StudentInfoView from '../students/StudentInfoView'
import PaymentRecordsEditor from './PaymentRecordsEditor'
import './enrollmentBillingDetail.css'

const DUPLICATE_PAYMENT_ERROR = '所選課程已經有付款資料'
const MISSING_COURSE_ID_ERROR = '課程資料已更新，請重新載入後再試'
const MISSING_RECEIPT_ID_ERROR = '繳費資料已更新，請重新載入後再試'
const EMPTY_COURSES_ERROR = '請至少選擇一門課程'
const DELETE_CONFIRMATION = '確定刪除此筆繳費紀錄？金額與收據編號將無法復原。'

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
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saveInFlight = useRef(false)

  useEffect(() => {
    if (enrollmentId == null) return
    setEditor(null)
    setIsSaving(false)
    setError('')
    setSuccess('')
  }, [enrollmentId])

  if (!student || !enrollment) return null

  const courses = enrollment.courses || []
  const courseDetails = enrollment.courseDetails || []
  const existingReceipts = enrollment.billingReceipts || []
  const availableCourses = courseDetails.filter(course => course.billingReceiptId == null)
  const availableCourseNames = availableCourses.map(course => course.courseName)
  const hasLegacyBilling =
    enrollment.amount != null || Boolean(String(enrollment.invoice_number ?? '').trim())

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleClose = () => {
    if (!saveInFlight.current) onClose?.()
  }

  const handleRefundToggle = async () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return

    const newRefunded = !enrollment.refunded
    saveInFlight.current = true
    setIsSaving(true)
    clearMessages()
    try {
      await updateEnrollmentRefundStatus(supabase, enrollmentId, newRefunded, null)
      setSuccess(newRefunded ? '已標記為退費' : '已恢復為正常')
      onRefresh?.()
    } catch {
      setError('退費狀態更新失敗')
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const startCreatingReceipt = () => {
    if (saveInFlight.current || availableCourses.length === 0) return
    setEditor({
      mode: 'create',
      courseIds: [],
      amount: '',
      invoiceNumber: '',
    })
    clearMessages()
  }

  const startEditingReceipt = receipt => {
    if (saveInFlight.current) return
    if (!isValidId(receipt.receiptId)) {
      setError(MISSING_RECEIPT_ID_ERROR)
      return
    }

    setEditor({
      mode: 'edit',
      receiptId: receipt.receiptId,
      courses: receipt.courses || [],
      amount: receipt.amount == null ? '' : String(receipt.amount),
      invoiceNumber: receipt.invoiceNumber || '',
    })
    clearMessages()
  }

  const updateEditor = field => event => {
    const { value } = event.target
    setEditor(current => current ? { ...current, [field]: value } : current)
  }

  const updateCreateRecord = records => {
    if (saveInFlight.current) return
    if (records.length === 0) {
      setEditor(null)
      return
    }

    const record = records[0]
    setEditor({
      mode: 'create',
      courseIds: record.courseNames.map(courseName => (
        availableCourses.find(course => course.courseName === courseName)?.courseId
      )),
      amount: record.amount,
      invoiceNumber: record.invoiceNumber,
    })
    clearMessages()
  }

  const validateEditor = () => {
    normalizePaymentAmount(editor.amount)

    if (editor.mode === 'create') {
      if (editor.courseIds.length === 0) throw new Error(EMPTY_COURSES_ERROR)
      if (editor.courseIds.some(courseId => !isValidId(courseId))) {
        throw new Error(MISSING_COURSE_ID_ERROR)
      }
      return
    }

    if (!isValidId(editor.receiptId)) throw new Error(MISSING_RECEIPT_ID_ERROR)
  }

  const handleSave = async event => {
    event.preventDefault()
    if (!permissions.canEditEnrollment || !editor || saveInFlight.current) return

    try {
      validateEditor()
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : '繳費紀錄格式錯誤')
      setSuccess('')
      return
    }

    saveInFlight.current = true
    setIsSaving(true)
    clearMessages()
    try {
      const billing = {
        amount: editor.amount,
        invoiceNumber: editor.invoiceNumber,
      }
      if (editor.mode === 'create') {
        await createBillingReceipt(supabase, editor.courseIds, billing)
      } else {
        await updateBillingReceipt(supabase, editor.receiptId, billing)
      }

      setEditor(null)
      setSuccess('繳費紀錄已儲存')
      onRefresh?.()
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : '繳費紀錄儲存失敗'
      setError(message)
      if (message === DUPLICATE_PAYMENT_ERROR) onRefresh?.()
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const handleDeleteReceipt = async receipt => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return
    if (!isValidId(receipt.receiptId)) {
      setError(MISSING_RECEIPT_ID_ERROR)
      return
    }
    if (!window.confirm(DELETE_CONFIRMATION)) return

    saveInFlight.current = true
    setIsSaving(true)
    clearMessages()
    try {
      await deleteBillingReceipt(supabase, receipt.receiptId)
      setEditor(current => (
        current?.mode === 'edit' && current.receiptId === receipt.receiptId ? null : current
      ))
      setSuccess('繳費紀錄已刪除')
      onRefresh?.()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '繳費紀錄刪除失敗')
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const createRecords = editor?.mode === 'create'
    ? [{
        localId: 'billing-receipt-create',
        courseNames: editor.courseIds
          .map(courseId => availableCourses.find(course => course.courseId === courseId)?.courseName)
          .filter(Boolean),
        amount: editor.amount,
        invoiceNumber: editor.invoiceNumber,
      }]
    : []

  return (
    <div className="modal-overlay enrollment-billing-overlay" onClick={handleClose}>
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
              {student.name} · {enrollment.period}
            </p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={handleClose}
            disabled={isSaving}
            aria-label="Close enrollment billing details"
          >
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

          <section className="enrollment-billing-receipts" aria-labelledby="billing-receipts-title">
            <div className="enrollment-billing-heading">
              <h3 id="billing-receipts-title">繳費紀錄</h3>
              <div className="enrollment-billing-actions">
                <span className={`badge ${enrollment.refunded ? 'danger' : 'success'}`}>
                  {enrollment.refunded ? '退費' : '正常'}
                </span>
                {permissions.canEditEnrollment && (
                  <button
                    type="button"
                    className={enrollment.refunded ? 'btn-secondary' : 'btn-danger'}
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    disabled={isSaving}
                    onClick={handleRefundToggle}
                  >
                    {enrollment.refunded ? '取消退費' : '標記退費'}
                  </button>
                )}
              </div>
            </div>

            <div className="billing-receipt-list">
              {existingReceipts.length === 0 && (
                <p className="billing-receipt-empty">尚未建立繳費紀錄</p>
              )}
              {existingReceipts.map((receipt, index) => (
                <article
                  className="billing-receipt-row"
                  key={receipt.receiptId ?? `billing-receipt-${index}`}
                >
                  <div className="billing-receipt-courses" aria-label="涵蓋課程">
                    {(receipt.courses || []).map((course, courseIndex) => (
                      <span
                        className="course-tag"
                        key={course.courseId ?? `${course.courseName}-${courseIndex}`}
                      >
                        {course.courseName}
                      </span>
                    ))}
                  </div>
                  <div className="billing-receipt-values">
                    <span>
                      <span className="billing-receipt-label">總金額</span>
                      {displayAmount(receipt.amount)}
                    </span>
                    <span>
                      <span className="billing-receipt-label">收據編號</span>
                      {displayInvoiceNumber(receipt.invoiceNumber)}
                    </span>
                  </div>
                  {permissions.canEditEnrollment && (
                    <div className="billing-receipt-row-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={isSaving}
                        onClick={() => startEditingReceipt(receipt)}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        disabled={isSaving}
                        onClick={() => handleDeleteReceipt(receipt)}
                      >
                        刪除
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>

            {permissions.canEditEnrollment && editor?.mode !== 'create' && (
              <div className="enrollment-billing-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={isSaving || availableCourses.length === 0}
                  onClick={startCreatingReceipt}
                >
                  新增繳費紀錄
                </button>
              </div>
            )}

            {permissions.canEditEnrollment && editor?.mode === 'create' && (
              <form className="billing-receipt-editor billing-receipt-create-editor" onSubmit={handleSave}>
                <PaymentRecordsEditor
                  selectedCourseNames={availableCourseNames}
                  records={createRecords}
                  onChange={updateCreateRecord}
                  disabled={isSaving}
                />
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
                    {isSaving ? '儲存中…' : '儲存繳費紀錄'}
                  </button>
                </div>
              </form>
            )}

            {permissions.canEditEnrollment && editor?.mode === 'edit' && (
              <form className="billing-receipt-editor" onSubmit={handleSave}>
                <div className="billing-receipt-courses" aria-label="涵蓋課程">
                  {editor.courses.map((course, index) => (
                    <span
                      className="course-tag"
                      key={course.courseId ?? `${course.courseName}-${index}`}
                    >
                      {course.courseName}
                    </span>
                  ))}
                </div>
                <div className="enrollment-billing-fields">
                  <div className="form-group">
                    <label className="form-label" htmlFor="billing-receipt-amount">總金額</label>
                    <input
                      id="billing-receipt-amount"
                      className="form-input"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="numeric"
                      value={editor.amount}
                      disabled={isSaving}
                      onChange={updateEditor('amount')}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="billing-receipt-invoice-number">收據編號</label>
                    <input
                      id="billing-receipt-invoice-number"
                      className="form-input"
                      value={editor.invoiceNumber}
                      disabled={isSaving}
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
                    {isSaving ? '儲存中…' : '儲存繳費紀錄'}
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
              <div className="billing-receipt-values">
                <span>
                  <span className="billing-receipt-label">金額</span>
                  {displayAmount(enrollment.amount)}
                </span>
                <span>
                  <span className="billing-receipt-label">收據編號</span>
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
