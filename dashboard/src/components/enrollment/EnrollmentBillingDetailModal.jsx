import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard'
import { supabase } from '../../lib/supabaseClient'
import {
  updateEnrollmentBillingDetails,
  updateEnrollmentRefundStatus,
} from '../../services/enrollmentService'
import ConfirmDialog from '../common/ConfirmDialog'
import StudentInfoView from '../students/StudentInfoView'
import './enrollmentBillingDetail.css'

function displayAmount(amount) {
  return amount == null || String(amount).trim() === '' ? '--' : `NT$ ${amount}`
}

function displayInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber ?? '').trim() || '--'
}

function createInitialFormData(enrollment) {
  return {
    period_start_date: enrollment?.period_start_date ?? '',
    period_end_date: enrollment?.period_end_date ?? '',
    prepaid_amount: enrollment?.prepaid_amount ?? '',
    prepaid_receipt_number: enrollment?.prepaid_receipt_number ?? '',
    tuition_fee: enrollment?.tuition_fee ?? '',
    materials_fee: enrollment?.materials_fee ?? '',
    membership_fee: enrollment?.membership_fee ?? '',
    fee_receipt_number: enrollment?.fee_receipt_number ?? '',
    handled_by_name: enrollment?.handled_by_name ?? '',
    handled_on: enrollment?.handled_on ?? '',
    notes: enrollment?.notes ?? '',
  }
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
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState(() => createInitialFormData(enrollment))
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isRefundConfirmOpen, setRefundConfirmOpen] = useState(false)
  const {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useUnsavedChangesGuard()
  const saveInFlight = useRef(false)

  useEffect(() => {
    if (enrollmentId == null) return
    setIsSaving(false)
    setIsEditing(false)
    setFormData(createInitialFormData(enrollment))
    setHasUnsavedChanges(false)
    setError('')
    setSuccess('')
    cancelPendingAction()
  }, [enrollmentId, enrollment])

  if (!student || !enrollment) return null

  const courses = enrollment.courses || []
  const hasLegacyBilling =
    enrollment.amount != null || Boolean(String(enrollment.invoice_number ?? '').trim())

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleFieldChange = (field, value) => {
    setHasUnsavedChanges(true)
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleClose = () => {
    if (!saveInFlight.current) {
      if (isEditing && hasUnsavedChanges) {
        requestAction(() => onClose?.())
      } else {
        onClose?.()
      }
    }
  }

  const handleStartEdit = () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return
    clearMessages()
    setFormData(createInitialFormData(enrollment))
    setHasUnsavedChanges(false)
    setIsEditing(true)
  }

  const handleCancel = () => {
    const doCancel = () => {
      clearMessages()
      setFormData(createInitialFormData(enrollment))
      setIsEditing(false)
      setHasUnsavedChanges(false)
    }

    if (hasUnsavedChanges) {
      requestAction(doCancel)
    } else {
      doCancel()
    }
  }

  const handleSave = async () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return

    if (
      formData.period_start_date &&
      formData.period_end_date &&
      formData.period_start_date > formData.period_end_date
    ) {
      setError('結束日期不能早於開始日期')
      return
    }

    const amountFields = [
      formData.prepaid_amount,
      formData.tuition_fee,
      formData.materials_fee,
      formData.membership_fee,
    ]
    const hasInvalidAmount = amountFields.some(val => {
      if (val === '' || val == null) return false
      const num = Number(val)
      return Number.isNaN(num) || num < 0
    })

    if (hasInvalidAmount) {
      setError('金額必須為非負整數')
      return
    }

    saveInFlight.current = true
    setIsSaving(true)
    clearMessages()

    try {
      await updateEnrollmentBillingDetails(supabase, enrollmentId, formData)
      setSuccess('帳單明細已更新')
      setIsEditing(false)
      setHasUnsavedChanges(false)
      onRefresh?.()
    } catch (err) {
      setError(err?.message || '帳單明細更新失敗')
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  const handleRefundClick = () => {
    if (!permissions.canEditEnrollment || saveInFlight.current) return
    setRefundConfirmOpen(true)
  }

  const handleRefundConfirm = async () => {
    setRefundConfirmOpen(false)
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
    <div className="modal-overlay enrollment-billing-overlay">
      <div
        className="modal-content enrollment-billing-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="enrollment-billing-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <div className="enrollment-billing-title-row">
              <h2 id="enrollment-billing-title">帳單明細</h2>
              <span className={`badge ${enrollment.refunded ? 'danger' : 'success'}`}>
                {enrollment.refunded ? '退費' : '正常'}
              </span>
              {permissions.canEditEnrollment && !isEditing && (
                <>
                  <button
                    type="button"
                    className={enrollment.refunded ? 'btn-secondary' : 'btn-danger'}
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    disabled={isSaving}
                    onClick={handleRefundClick}
                  >
                    {enrollment.refunded ? '取消退費' : '標記退費'}
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '12px' }}
                    disabled={isSaving}
                    onClick={handleStartEdit}
                  >
                    編輯
                  </button>
                </>
              )}
              {permissions.canEditEnrollment && isEditing && (
                <>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ padding: '2px 10px', fontSize: '12px' }}
                    disabled={isSaving}
                    onClick={handleSave}
                  >
                    儲存
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    style={{ padding: '2px 10px', fontSize: '12px' }}
                    disabled={isSaving}
                    onClick={handleCancel}
                  >
                    取消
                  </button>
                </>
              )}
            </div>
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

          {/* 收費明細 */}
          <section className="enrollment-fee-details" aria-labelledby="fee-details-title">
            <div className="fee-details-heading">
              <h3 id="fee-details-title">收費明細</h3>
              {isEditing ? (
                <div className="enrollment-period-dates-edit">
                  <span className="billing-receipt-label" style={{ margin: 0 }}>起訖：</span>
                  <input
                    type="date"
                    className="billing-edit-input billing-date-input"
                    aria-label="期別開始日期"
                    value={formData.period_start_date}
                    disabled={isSaving}
                    onChange={e => handleFieldChange('period_start_date', e.target.value)}
                  />
                  <span style={{ margin: '0 4px', fontSize: '12px', color: 'var(--text-secondary)' }}>至</span>
                  <input
                    type="date"
                    className="billing-edit-input billing-date-input"
                    aria-label="期別結束日期"
                    value={formData.period_end_date}
                    disabled={isSaving}
                    onChange={e => handleFieldChange('period_end_date', e.target.value)}
                  />
                </div>
              ) : (
                (enrollment.period_start_date || enrollment.period_end_date) && (
                  <span className="enrollment-period-dates">
                    起訖：{enrollment.period_start_date || '--'} 至 {enrollment.period_end_date || '--'}
                  </span>
                )
              )}
            </div>

            <div className="fee-details-grid">
              {/* 預繳 */}
              <div className="fee-details-card">
                <h4 className="fee-details-card-title">預繳</h4>
                <div className="billing-receipt-values">
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-prepaid-amount">金額</label>
                    {isEditing ? (
                      <input
                        id="billing-prepaid-amount"
                        type="number"
                        min="0"
                        step="1"
                        className="billing-edit-input"
                        aria-label="預繳金額"
                        value={formData.prepaid_amount}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('prepaid_amount', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayAmount(enrollment.prepaid_amount)}</span>
                    )}
                  </span>
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-prepaid-receipt">收據 No.</label>
                    {isEditing ? (
                      <input
                        id="billing-prepaid-receipt"
                        type="text"
                        className="billing-edit-input"
                        aria-label="預繳收據號碼"
                        value={formData.prepaid_receipt_number}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('prepaid_receipt_number', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayInvoiceNumber(enrollment.prepaid_receipt_number)}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* 正式費用 */}
              <div className="fee-details-card">
                <h4 className="fee-details-card-title">正式費用</h4>
                <div className="fee-breakdown">
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-tuition-fee">學費</label>
                    {isEditing ? (
                      <input
                        id="billing-tuition-fee"
                        type="number"
                        min="0"
                        step="1"
                        className="billing-edit-input"
                        aria-label="學費"
                        value={formData.tuition_fee}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('tuition_fee', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayAmount(enrollment.tuition_fee)}</span>
                    )}
                  </span>
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-materials-fee">教材費</label>
                    {isEditing ? (
                      <input
                        id="billing-materials-fee"
                        type="number"
                        min="0"
                        step="1"
                        className="billing-edit-input"
                        aria-label="教材費"
                        value={formData.materials_fee}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('materials_fee', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayAmount(enrollment.materials_fee)}</span>
                    )}
                  </span>
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-membership-fee">會友費</label>
                    {isEditing ? (
                      <input
                        id="billing-membership-fee"
                        type="number"
                        min="0"
                        step="1"
                        className="billing-edit-input"
                        aria-label="會友費"
                        value={formData.membership_fee}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('membership_fee', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayAmount(enrollment.membership_fee)}</span>
                    )}
                  </span>
                </div>
                <div className="billing-receipt-values fee-total">
                  <span>
                    <span className="billing-receipt-label">合計</span>
                    <span className="billing-receipt-value fee-total-value" aria-label="正式費用合計">
                      {isEditing
                        ? displayAmount(
                            (formData.tuition_fee !== '' || formData.materials_fee !== '' || formData.membership_fee !== '')
                              ? (Number(formData.tuition_fee) || 0) + (Number(formData.materials_fee) || 0) + (Number(formData.membership_fee) || 0)
                              : null
                          )
                        : displayAmount(
                            (enrollment.tuition_fee != null || enrollment.materials_fee != null || enrollment.membership_fee != null)
                              ? (enrollment.tuition_fee || 0) + (enrollment.materials_fee || 0) + (enrollment.membership_fee || 0)
                              : null
                          )}
                    </span>
                  </span>
                  <span>
                    <label className="billing-receipt-label" htmlFor="billing-fee-receipt">收據 No.</label>
                    {isEditing ? (
                      <input
                        id="billing-fee-receipt"
                        type="text"
                        className="billing-edit-input"
                        aria-label="正式收據號碼"
                        value={formData.fee_receipt_number}
                        disabled={isSaving}
                        onChange={e => handleFieldChange('fee_receipt_number', e.target.value)}
                      />
                    ) : (
                      <span className="billing-receipt-value">{displayInvoiceNumber(enrollment.fee_receipt_number)}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {error && <p className="enrollment-billing-message error" role="alert">{error}</p>}
          {success && <p className="enrollment-billing-message success">{success}</p>}

          {/* 辦理資訊 */}
          <section className="enrollment-handler-info" aria-labelledby="handler-info-title">
            <h3 id="handler-info-title">辦理資訊</h3>
            <div className="handler-info-grid">
              <span>
                <label className="billing-receipt-label" htmlFor="billing-handled-by-name">經手人</label>
                {isEditing ? (
                  <input
                    id="billing-handled-by-name"
                    type="text"
                    className="billing-edit-input"
                    aria-label="經手人"
                    value={formData.handled_by_name}
                    disabled={isSaving}
                    onChange={e => handleFieldChange('handled_by_name', e.target.value)}
                  />
                ) : (
                  <span className="billing-receipt-value">{enrollment.handled_by_name || '--'}</span>
                )}
              </span>
              <span>
                <label className="billing-receipt-label" htmlFor="billing-handled-on">辦理日期</label>
                {isEditing ? (
                  <input
                    id="billing-handled-on"
                    type="date"
                    className="billing-edit-input"
                    aria-label="辦理日期"
                    value={formData.handled_on}
                    disabled={isSaving}
                    onChange={e => handleFieldChange('handled_on', e.target.value)}
                  />
                ) : (
                  <span className="billing-receipt-value">{enrollment.handled_on || '--'}</span>
                )}
              </span>
              <span>
                <span className="billing-receipt-label">登入帳號</span>
                <span className="billing-receipt-value">{enrollment.handled_by_account || '--'}</span>
              </span>
            </div>
            {isEditing ? (
              <div className="handler-notes-box">
                <label className="billing-receipt-label" htmlFor="billing-notes">備註</label>
                <textarea
                  id="billing-notes"
                  className="billing-edit-textarea"
                  aria-label="備註"
                  rows="3"
                  value={formData.notes}
                  disabled={isSaving}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                />
              </div>
            ) : (
              enrollment.notes && (
                <div className="handler-notes-box">
                  <span className="billing-receipt-label">備註</span>
                  <p className="handler-notes-text">{enrollment.notes}</p>
                </div>
              )
            )}
          </section>

          {hasLegacyBilling && (
            <section className="enrollment-legacy-billing" aria-labelledby="legacy-billing-title">
              <h3 id="legacy-billing-title">舊制帳單</h3>
              <div className="billing-receipt-values">
                <span>
                  <span className="billing-receipt-label">金額</span>
                  <span className="billing-receipt-value">{displayAmount(enrollment.amount)}</span>
                </span>
                <span>
                  <span className="billing-receipt-label">收據編號</span>
                  <span className="billing-receipt-value">{displayInvoiceNumber(enrollment.invoice_number)}</span>
                </span>
              </div>
            </section>
          )}

          <section className="enrollment-billing-student" aria-label="學員資訊">
            <StudentInfoView student={student} />
          </section>
        </div>
      </div>

      <ConfirmDialog
        isOpen={!!pendingAction}
        title="尚有未儲存變更"
        message="離開後本次修改將不會保留，確定要放棄變更嗎？"
        confirmLabel="放棄變更"
        onConfirm={confirmPendingAction}
        onCancel={cancelPendingAction}
      />
      
      <ConfirmDialog
        isOpen={isRefundConfirmOpen}
        title={enrollment.refunded ? "取消退費確認" : "標記退費確認"}
        message={enrollment.refunded ? "確定要將此筆報名恢復為正常狀態嗎？" : "確定要將此筆報名標記為退費嗎？此操作可透過「取消退費」復原。"}
        confirmLabel={enrollment.refunded ? "確定恢復" : "確定退費"}
        onConfirm={handleRefundConfirm}
        onCancel={() => setRefundConfirmOpen(false)}
      />
    </div>
  )
}
