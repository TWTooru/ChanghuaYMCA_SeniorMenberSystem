import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { updateEnrollmentForm } from '../../services/enrollmentService'
import CourseTagPicker from './CourseTagPicker'
import './enrollmentBillingDetail.css'

function displayAmount(amount) {
  return amount == null || String(amount).trim() === '' ? '--' : `NT$ ${amount}`
}

export default function EnrollmentFormEditor({
  form,
  siblingCourseNames = [],
  onSave,
  onCancel,
}) {
  const [formData, setFormData] = useState(() => ({
    reg_type: form?.reg_type || '續',
    courses: form?.courses || [],
    prepaid_amount: form?.prepaid_amount ?? '',
    prepaid_receipt_number: form?.prepaid_receipt_number ?? '',
    tuition_fee: form?.tuition_fee ?? '',
    materials_fee: form?.materials_fee ?? '',
    membership_fee: form?.membership_fee ?? '',
    fee_receipt_number: form?.fee_receipt_number ?? '',
    handled_by_name: form?.handled_by_name ?? '',
    reported_on: form?.reported_on ?? '',
    notes: form?.notes ?? '',
  }))

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const saveInFlight = useRef(false)

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const tuition = Number(formData.tuition_fee) || 0
  const materials = Number(formData.materials_fee) || 0
  const membership = Number(formData.membership_fee) || 0
  const hasFormalFee = formData.tuition_fee !== '' || formData.materials_fee !== '' || formData.membership_fee !== ''
  const formalTotal = hasFormalFee ? tuition + materials + membership : null

  const handleSubmit = async event => {
    event?.preventDefault?.()
    if (saveInFlight.current) return

    if (!formData.courses || formData.courses.length === 0) {
      setError('請至少選擇一門課程')
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
    setError('')

    try {
      const payload = {
        ...formData,
        prepaid_amount: formData.prepaid_amount === '' || formData.prepaid_amount == null ? null : Number(formData.prepaid_amount),
        tuition_fee: formData.tuition_fee === '' || formData.tuition_fee == null ? null : Number(formData.tuition_fee),
        materials_fee: formData.materials_fee === '' || formData.materials_fee == null ? null : Number(formData.materials_fee),
        membership_fee: formData.membership_fee === '' || formData.membership_fee == null ? null : Number(formData.membership_fee),
        reported_on: formData.reported_on || null,
        notes: formData.notes || null,
        handled_by_name: formData.handled_by_name || null,
        prepaid_receipt_number: formData.prepaid_receipt_number || null,
        fee_receipt_number: formData.fee_receipt_number || null,
      }
      await updateEnrollmentForm(supabase, form.form_id, payload)
      onSave?.()
    } catch (err) {
      setError(err?.message || '更新報名表失敗')
    } finally {
      saveInFlight.current = false
      setIsSaving(false)
    }
  }

  return (
    <form noValidate className="fee-details-card enrollment-form-editor" onSubmit={handleSubmit} data-testid={`form-editor-${form.form_id}`}>
      <div className="enrollment-form-card-header">
        <div className="enrollment-form-card-title-group">
          <h4 className="enrollment-form-card-title">編輯報名表 {form.form_sequence}</h4>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="visually-hidden" htmlFor="editor-reg-type">新/續生</label>
            <select
              id="editor-reg-type"
              className="form-select"

             value={formData.reg_type}
              disabled={isSaving}
              onChange={e => handleFieldChange('reg_type', e.target.value)}
            >
              <option value="新">新</option>
              <option value="續">續</option>
            </select>
          </div>
        </div>

        <div className="enrollment-form-card-actions">
          <button
            type="submit"
            className="btn-primary"

            disabled={isSaving}
          >
            儲存
          </button>
          <button
            type="button"
            className="btn-secondary"

            disabled={isSaving}
            onClick={() => onCancel?.()}
          >
            取消
          </button>
        </div>
      </div>

      <div className="form-group full-width" style={{ marginTop: '12px' }}>
        <span className="billing-receipt-label">選修課程 *</span>
        <CourseTagPicker
          selectedCourseNames={formData.courses}
          lockedCourseNames={siblingCourseNames}
          disabled={isSaving}
          onChange={courses => handleFieldChange('courses', courses)}
        />
      </div>

      <div className="form-card-fee-grid">
        {/* 預繳 */}
        <div className="fee-details-card sub-card">
          <h5 className="fee-details-card-title">預繳</h5>
          <div className="billing-receipt-values">
            <span>
              <label className="billing-receipt-label" htmlFor="editor-prepaid-amount">金額</label>
              <input
                id="editor-prepaid-amount"
                type="number"
                min="0"
                step="1"
                className="billing-edit-input"
                aria-label="預繳金額"
               value={formData.prepaid_amount}
                disabled={isSaving}
                onChange={e => handleFieldChange('prepaid_amount', e.target.value)}
              />
            </span>
            <span>
              <label className="billing-receipt-label" htmlFor="editor-prepaid-receipt">收據 No.</label>
              <input
                id="editor-prepaid-receipt"
                type="text"
                className="billing-edit-input"
                aria-label="預繳收據號碼"
               value={formData.prepaid_receipt_number}
                disabled={isSaving}
                onChange={e => handleFieldChange('prepaid_receipt_number', e.target.value)}
              />
            </span>
          </div>
        </div>

        {/* 正式費用 */}
        <div className="fee-details-card sub-card">
          <h5 className="fee-details-card-title">正式費用</h5>
          <div className="fee-breakdown">
            <span>
              <label className="billing-receipt-label" htmlFor="editor-tuition-fee">學費</label>
              <input
                id="editor-tuition-fee"
                type="number"
                min="0"
                step="1"
                className="billing-edit-input"
                aria-label="學費"
               value={formData.tuition_fee}
                disabled={isSaving}
                onChange={e => handleFieldChange('tuition_fee', e.target.value)}
              />
            </span>
            <span>
              <label className="billing-receipt-label" htmlFor="editor-materials-fee">教材費</label>
              <input
                id="editor-materials-fee"
                type="number"
                min="0"
                step="1"
                className="billing-edit-input"
                aria-label="教材費"
               value={formData.materials_fee}
                disabled={isSaving}
                onChange={e => handleFieldChange('materials_fee', e.target.value)}
              />
            </span>
            <span>
              <label className="billing-receipt-label" htmlFor="editor-membership-fee">會友費</label>
              <input
                id="editor-membership-fee"
                type="number"
                min="0"
                step="1"
                className="billing-edit-input"
                aria-label="會友費"
               value={formData.membership_fee}
                disabled={isSaving}
                onChange={e => handleFieldChange('membership_fee', e.target.value)}
              />
            </span>
          </div>
          <div className="billing-receipt-values fee-total">
            <span>
              <span className="billing-receipt-label">合計</span>
              <span className="billing-receipt-value fee-total-value" aria-label="正式費用合計">
                {displayAmount(formalTotal)}
              </span>
            </span>
            <span>
              <label className="billing-receipt-label" htmlFor="editor-fee-receipt">收據 No.</label>
              <input
                id="editor-fee-receipt"
                type="text"
                className="billing-edit-input"
                aria-label="正式收據號碼"
               value={formData.fee_receipt_number}
                disabled={isSaving}
                onChange={e => handleFieldChange('fee_receipt_number', e.target.value)}
              />
            </span>
          </div>
        </div>
      </div>

      <div className="form-card-handler-info" style={{ marginTop: '12px' }}>
        <div className="handler-info-grid">
          <span>
            <label className="billing-receipt-label" htmlFor="editor-handled-by-name">經手人</label>
            <input
              id="editor-handled-by-name"
              type="text"
              className="billing-edit-input"
              aria-label="經手人"
             value={formData.handled_by_name}
              disabled={isSaving}
              onChange={e => handleFieldChange('handled_by_name', e.target.value)}
            />
          </span>
          <span>
            <label className="billing-receipt-label" htmlFor="editor-reported-on">報到日期</label>
            <input
              id="editor-reported-on"
              type="date"
              className="billing-edit-input"
              aria-label="報到日期"
             value={formData.reported_on}
              disabled={isSaving}
              onChange={e => handleFieldChange('reported_on', e.target.value)}
            />
          </span>
          <span>
            <span className="billing-receipt-label">登入帳號</span>
            <span className="billing-receipt-value">{form.handled_by_account || '--'}</span>
          </span>
        </div>
        <div className="handler-notes-box" style={{ marginTop: '8px' }}>
          <label className="billing-receipt-label" htmlFor="editor-notes">備註</label>
          <textarea
            id="editor-notes"
            className="billing-edit-textarea"
            aria-label="備註"
            rows="3"
           value={formData.notes}
            disabled={isSaving}
            onChange={e => handleFieldChange('notes', e.target.value)}
          />
        </div>
      </div>

      {error && <p className="enrollment-billing-message error" role="alert" style={{ marginTop: '10px' }}>{error}</p>}
    </form>
  )
}
