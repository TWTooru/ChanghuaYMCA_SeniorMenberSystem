import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import useUnsavedChangesGuard from '../../hooks/useUnsavedChangesGuard'
import { supabase } from '../../lib/supabaseClient'
import {
  updateEnrollmentFormRefundStatus,
  deleteEnrollmentForm,
} from '../../services/enrollmentService'
import ConfirmDialog from '../common/ConfirmDialog'
import StudentInfoView from '../students/StudentInfoView'
import EnrollmentFormCard from './EnrollmentFormCard'
import EnrollmentFormEditor from './EnrollmentFormEditor'
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

  const [editingFormId, setEditingFormId] = useState(null)
  const [refundTargetForm, setRefundTargetForm] = useState(null)
  const [deleteTargetForm, setDeleteTargetForm] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  } = useUnsavedChangesGuard()
  const operationInFlight = useRef(false)

  useEffect(() => {
    if (enrollmentId == null) return
    setEditingFormId(null)
    setRefundTargetForm(null)
    setDeleteTargetForm(null)
    setIsProcessing(false)
    setHasUnsavedChanges(false)
    setError('')
    setSuccess('')
    cancelPendingAction()
  }, [enrollmentId, enrollment, setHasUnsavedChanges, cancelPendingAction])

  if (!student || !enrollment) return null

  const forms = enrollment.forms || []
  const hasLegacyBilling =
    forms.length === 0 &&
    (enrollment.amount != null || Boolean(String(enrollment.invoice_number ?? '').trim()))

  const clearMessages = () => {
    setError('')
    setSuccess('')
  }

  const handleClose = () => {
    if (!operationInFlight.current) {
      if (editingFormId && hasUnsavedChanges) {
        requestAction(() => onClose?.())
      } else {
        onClose?.()
      }
    }
  }

  const handleStartEdit = formId => {
    if (!permissions.canEditEnrollment || operationInFlight.current) return
    clearMessages()
    setEditingFormId(formId)
    setHasUnsavedChanges(false)
  }

  const handleEditorCancel = () => {
    clearMessages()
    setEditingFormId(null)
    setHasUnsavedChanges(false)
  }

  const handleEditorSave = () => {
    setSuccess('報名表已更新')
    setEditingFormId(null)
    setHasUnsavedChanges(false)
    onRefresh?.()
  }

  const handleRefundConfirm = async () => {
    if (!refundTargetForm) return
    const target = refundTargetForm
    setRefundTargetForm(null)
    const newRefunded = !target.refunded

    operationInFlight.current = true
    setIsProcessing(true)
    clearMessages()
    try {
      await updateEnrollmentFormRefundStatus(supabase, target.form_id, newRefunded, null)
      setSuccess(newRefunded ? '報名表已標記為退費' : '報名表已恢復為正常')
      onRefresh?.()
    } catch (err) {
      setError(err?.message || '退費狀態更新失敗')
    } finally {
      operationInFlight.current = false
      setIsProcessing(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteTargetForm) return
    const target = deleteTargetForm
    setDeleteTargetForm(null)

    operationInFlight.current = true
    setIsProcessing(true)
    clearMessages()
    try {
      const res = await deleteEnrollmentForm(supabase, target.form_id)
      setSuccess('報名表已刪除')
      if (res?.enrollment_deleted) {
        onClose?.()
      }
      onRefresh?.()
    } catch (err) {
      setError(err?.message || '刪除報名表失敗')
    } finally {
      operationInFlight.current = false
      setIsProcessing(false)
    }
  }

  const refundStatusBadgeText =
    enrollment.refundStatus === 'refunded' || enrollment.refunded
      ? '退費'
      : enrollment.refundStatus === 'partial'
      ? '部分退費'
      : '正常'

  const refundStatusBadgeClass =
    enrollment.refundStatus === 'refunded' || enrollment.refunded
      ? 'danger'
      : enrollment.refundStatus === 'partial'
      ? 'warning'
      : 'success'

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
              <span className={`badge ${refundStatusBadgeClass}`}>
                {refundStatusBadgeText}
              </span>
            </div>
            <p className="enrollment-billing-subtitle">
              {student.name} · {enrollment.period}
            </p>
          </div>
          <button
            type="button"
            className="btn-close"
            onClick={handleClose}
            disabled={isProcessing}
            aria-label="Close enrollment billing details"
          >
            <X size={20} />
          </button>
        </div>

        <div className="modal-body enrollment-billing-body">
          {/* 期別起訖日期 */}
          {(enrollment.period_start_date || enrollment.period_end_date) && (
            <div className="fee-details-heading" style={{ paddingBottom: '8px' }}>
              <span className="enrollment-period-dates">
                起訖：{enrollment.period_start_date || '--'} 至 {enrollment.period_end_date || '--'}
              </span>
            </div>
          )}

          {error && <p className="enrollment-billing-message error" role="alert">{error}</p>}
          {success && <p className="enrollment-billing-message success">{success}</p>}

          {/* 表單卡片清單 */}
          <section className="enrollment-forms-section" aria-label="報名表清單">
            {forms.map(form => {
              if (form.form_id === editingFormId) {
                const siblingCourses = forms
                  .filter(f => f.form_id !== form.form_id)
                  .flatMap(f => f.courses || [])

                return (
                  <EnrollmentFormEditor
                    key={form.form_id}
                    form={form}
                    siblingCourseNames={siblingCourses}
                    onSave={handleEditorSave}
                    onCancel={handleEditorCancel}
                  />
                )
              }

              return (
                <EnrollmentFormCard
                  key={form.form_id}
                  form={form}
                  canEdit={permissions.canEditEnrollment}
                  canDelete={role === 'admin'}
                  onEdit={() => handleStartEdit(form.form_id)}
                  onToggleRefund={() => setRefundTargetForm(form)}
                  onDelete={() => setDeleteTargetForm(form)}
                  disabled={isProcessing || editingFormId !== null}
                />
              )
            })}
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
        isOpen={Boolean(refundTargetForm)}
        title={refundTargetForm?.refunded ? "取消退費確認" : "標記退費確認"}
        message={
          refundTargetForm?.refunded
            ? `確定要將「報名表 ${refundTargetForm?.form_sequence}」恢復為正常狀態嗎？`
            : `確定要將「報名表 ${refundTargetForm?.form_sequence}」標記為退費嗎？`
        }
        confirmLabel={refundTargetForm?.refunded ? "確定恢復" : "確定退費"}
        onConfirm={handleRefundConfirm}
        onCancel={() => setRefundTargetForm(null)}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTargetForm)}
        title="刪除報名表確認"
        message={`確定要刪除「報名表 ${deleteTargetForm?.form_sequence}」嗎？此操作將刪除此報名表下的所有選課與收據，且無法復原。`}
        confirmLabel="確定刪除"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetForm(null)}
      />
    </div>
  )
}
