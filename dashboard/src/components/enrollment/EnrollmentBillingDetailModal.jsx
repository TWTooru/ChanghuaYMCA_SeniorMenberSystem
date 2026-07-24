import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import { supabase } from '../../lib/supabaseClient'
import { updateEnrollmentBilling } from '../../services/enrollmentService'
import StudentInfoView from '../students/StudentInfoView'
import './enrollmentBillingDetail.css'

export default function EnrollmentBillingDetailModal({
  student,
  enrollment,
  onClose,
  onRefresh,
}) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [amount, setAmount] = useState('')
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    if (!enrollment) return
    setAmount(enrollment.amount == null ? '' : String(enrollment.amount))
    setInvoiceNumber(enrollment.invoice_number || '')
    setError('')
    setSuccess('')
  }, [enrollment])

  if (!student || !enrollment) return null

  const handleSave = async event => {
    event.preventDefault()
    if (!permissions.canEditEnrollment || isSaving) return

    setIsSaving(true)
    setError('')
    setSuccess('')
    try {
      const saved = await updateEnrollmentBilling(
        supabase,
        enrollment.enrollment_id,
        { amount, invoice_number: invoiceNumber }
      )
      setAmount(saved.amount == null ? '' : String(saved.amount))
      setInvoiceNumber(saved.invoice_number || '')
      setSuccess('Billing saved')
      onRefresh?.()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
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
            <h2 id="enrollment-billing-title">Enrollment billing details</h2>
            <p className="enrollment-billing-subtitle">
              {student.name} · {enrollment.season}
            </p>
          </div>
          <button type="button" className="btn-close" onClick={onClose} aria-label="Close enrollment billing details">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body enrollment-billing-body">
          <section className="enrollment-billing-context" aria-label="Enrollment context">
            <div className="timeline-courses">
              {(enrollment.courses || []).map(course => (
                <span className="course-tag" key={course}>{course}</span>
              ))}
            </div>
            <span className={`badge ${enrollment.refunded ? 'danger' : 'success'}`}>
              {enrollment.refunded ? 'Refunded' : 'Active'}
            </span>
          </section>

          <form className="enrollment-billing-form" onSubmit={handleSave}>
            <h3>Billing</h3>
            <div className="enrollment-billing-fields">
              <div className="form-group">
                <label className="form-label" htmlFor="billing-amount">Amount</label>
                <input
                  id="billing-amount"
                  className="form-input"
                  inputMode="numeric"
                  value={amount}
                  readOnly={!permissions.canEditEnrollment}
                  onChange={event => setAmount(event.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="billing-invoice-number">Invoice number</label>
                <input
                  id="billing-invoice-number"
                  className="form-input"
                  value={invoiceNumber}
                  readOnly={!permissions.canEditEnrollment}
                  onChange={event => setInvoiceNumber(event.target.value)}
                />
              </div>
            </div>
            {error && <p className="enrollment-billing-message error" role="alert">{error}</p>}
            {success && <p className="enrollment-billing-message success">{success}</p>}
            {permissions.canEditEnrollment && (
              <div className="enrollment-billing-actions">
                <button type="submit" className="btn-primary" disabled={isSaving}>
                  {isSaving ? '儲存中…' : '儲存收費資料'}
                </button>
              </div>
            )}
          </form>

          <section className="enrollment-billing-student" aria-label="Student information">
            <StudentInfoView student={student} />
          </section>
        </div>
      </div>
    </div>
  )
}
