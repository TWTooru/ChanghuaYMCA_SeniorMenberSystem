import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabaseClient'
import { updateEnrollmentRefundStatus } from '../../services/enrollmentService'
import StudentInfoView from '../students/StudentInfoView'
import './enrollmentBillingDetail.css'

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
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const saveInFlight = useRef(false)

  useEffect(() => {
    if (enrollmentId == null) return
    setIsSaving(false)
    setError('')
    setSuccess('')
  }, [enrollmentId])

  if (!student || !enrollment) return null

  const courses = enrollment.courses || []
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

          {/* 報名費用與經手明細 */}
          <section className="enrollment-paper-billing" aria-labelledby="paper-billing-title">
            <div className="paper-billing-heading">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 id="paper-billing-title">報名費用與經手明細</h3>
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
              {(enrollment.period_start_date || enrollment.period_end_date) && (
                <span className="enrollment-period-dates">
                  起訖：{enrollment.period_start_date || '--'} 至 {enrollment.period_end_date || '--'}
                </span>
              )}
            </div>

            <div className="paper-billing-grid">
              {/* 預繳 */}
              <div className="paper-billing-card">
                <h4 className="paper-billing-card-title">預繳資料</h4>
                <div className="billing-receipt-values">
                  <span>
                    <span className="billing-receipt-label">預繳金額</span>
                    {displayAmount(enrollment.prepaid_amount)}
                  </span>
                  <span>
                    <span className="billing-receipt-label">預繳 No.</span>
                    {displayInvoiceNumber(enrollment.prepaid_receipt_number)}
                  </span>
                </div>
              </div>

              {/* 正式收據 */}
              <div className="paper-billing-card">
                <h4 className="paper-billing-card-title">正式收據明細</h4>
                <div className="paper-fee-items">
                  <span>
                    <span className="billing-receipt-label">學費</span>
                    {displayAmount(enrollment.tuition_fee)}
                  </span>
                  <span>
                    <span className="billing-receipt-label">教材費</span>
                    {displayAmount(enrollment.materials_fee)}
                  </span>
                  <span>
                    <span className="billing-receipt-label">會友費</span>
                    {displayAmount(enrollment.membership_fee)}
                  </span>
                </div>
                <div className="billing-receipt-values paper-fee-summary">
                  <span>
                    <span className="billing-receipt-label">正式費用合計</span>
                    {displayAmount(
                      (enrollment.tuition_fee != null || enrollment.materials_fee != null || enrollment.membership_fee != null)
                        ? (enrollment.tuition_fee || 0) + (enrollment.materials_fee || 0) + (enrollment.membership_fee || 0)
                        : null
                    )}
                  </span>
                  <span>
                    <span className="billing-receipt-label">正式收據 No.</span>
                    {displayInvoiceNumber(enrollment.fee_receipt_number)}
                  </span>
                </div>
              </div>

              {/* 經手人與備註 */}
              <div className="paper-billing-card full-width">
                <h4 className="paper-billing-card-title">經手與其他資訊</h4>
                <div className="paper-handler-grid">
                  <span>
                    <span className="billing-receipt-label">經手人姓名</span>
                    {enrollment.handled_by_name || '--'}
                  </span>
                  <span>
                    <span className="billing-receipt-label">辦理日期</span>
                    {enrollment.handled_on || '--'}
                  </span>
                  <span>
                    <span className="billing-receipt-label">登入帳號</span>
                    {enrollment.handled_by_account || '--'}
                  </span>
                </div>
                {enrollment.notes && (
                  <div className="paper-notes-box">
                    <span className="billing-receipt-label">備註</span>
                    <p className="paper-notes-text">{enrollment.notes}</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          {error && <p className="enrollment-billing-message error" role="alert">{error}</p>}
          {success && <p className="enrollment-billing-message success">{success}</p>}

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
