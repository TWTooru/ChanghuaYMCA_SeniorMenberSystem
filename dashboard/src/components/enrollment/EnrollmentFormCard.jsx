import './enrollmentBillingDetail.css'

function displayAmount(amount) {
  return amount == null || String(amount).trim() === '' ? '--' : `NT$ ${amount}`
}

function displayInvoiceNumber(invoiceNumber) {
  return String(invoiceNumber ?? '').trim() || '--'
}

export default function EnrollmentFormCard({
  form,
  canEdit = false,
  canDelete = false,
  onEdit,
  onToggleRefund,
  onDelete,
  disabled = false,
}) {
  if (!form) return null

  const courses = form.courses || []
  const tuition = Number(form.tuition_fee) || 0
  const materials = Number(form.materials_fee) || 0
  const membership = Number(form.membership_fee) || 0
  const hasFormalFee = form.tuition_fee != null || form.materials_fee != null || form.membership_fee != null
  const formalTotal = hasFormalFee ? tuition + materials + membership : null
  const otherReceipts = form.otherReceipts || []

  return (
    <div className={`fee-details-card enrollment-form-card ${form.refunded ? 'is-refunded' : ''}`} data-testid={`form-card-${form.form_id}`}>
      <div className="enrollment-form-card-header">
        <div className="enrollment-form-card-title-group">
          <h4 className="enrollment-form-card-title">報名表 {form.form_sequence}</h4>
          <span className={`badge ${form.refunded ? 'danger' : 'success'}`}>
            {form.refunded ? '退費' : '正常'}
          </span>
          {form.reg_type && <span className="reg-type-badge">{form.reg_type}</span>}
        </div>

        <div className="enrollment-form-card-actions">
          {canEdit && (
            <>
              <button
                type="button"
                className={form.refunded ? 'btn-secondary' : 'btn-danger'}
                style={{ padding: '2px 8px', fontSize: '12px' }}
                disabled={disabled}
                onClick={() => onToggleRefund?.(form)}
                aria-label={`報名表 ${form.form_sequence} ${form.refunded ? '取消退費' : '標記退費'}`}
              >
                {form.refunded ? '取消退費' : '標記退費'}
              </button>
              <button
                type="button"
                className="btn-secondary"
                style={{ padding: '2px 8px', fontSize: '12px' }}
                disabled={disabled}
                onClick={() => onEdit?.(form)}
                aria-label={`編輯報名表 ${form.form_sequence}`}
              >
                編輯
              </button>
            </>
          )}
          {canDelete && (
            <button
              type="button"
              className="btn-danger"
              style={{ padding: '2px 8px', fontSize: '12px' }}
              disabled={disabled}
              onClick={() => onDelete?.(form)}
              aria-label={`刪除報名表 ${form.form_sequence}`}
            >
              刪除
            </button>
          )}
        </div>
      </div>

      {courses.length > 0 && (
        <div className="form-card-courses">
          <span className="billing-receipt-label">報名課程：</span>
          <div className="timeline-courses" style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '4px' }}>
            {courses.map((course, idx) => (
              <span className="course-tag" key={`${course}-${idx}`}>{course}</span>
            ))}
          </div>
        </div>
      )}

      <div className="form-card-fee-grid">
        {/* 預繳 */}
        <div className="fee-details-card sub-card">
          <h5 className="fee-details-card-title">預繳</h5>
          <div className="billing-receipt-values">
            <span>
              <span className="billing-receipt-label">金額</span>
              <span className="billing-receipt-value">{displayAmount(form.prepaid_amount)}</span>
            </span>
            <span>
              <span className="billing-receipt-label">收據 No.</span>
              <span className="billing-receipt-value">{displayInvoiceNumber(form.prepaid_receipt_number)}</span>
            </span>
          </div>
        </div>

        {/* 正式費用 */}
        <div className="fee-details-card sub-card">
          <h5 className="fee-details-card-title">正式費用</h5>
          <div className="fee-breakdown">
            <span>
              <span className="billing-receipt-label">學費</span>
              <span className="billing-receipt-value">{displayAmount(form.tuition_fee)}</span>
            </span>
            <span>
              <span className="billing-receipt-label">教材費</span>
              <span className="billing-receipt-value">{displayAmount(form.materials_fee)}</span>
            </span>
            <span>
              <span className="billing-receipt-label">會友費</span>
              <span className="billing-receipt-value">{displayAmount(form.membership_fee)}</span>
            </span>
          </div>
          <div className="billing-receipt-values fee-total">
            <span>
              <span className="billing-receipt-label">合計</span>
              <span className="billing-receipt-value fee-total-value">{displayAmount(formalTotal)}</span>
            </span>
            <span>
              <span className="billing-receipt-label">收據 No.</span>
              <span className="billing-receipt-value">{displayInvoiceNumber(form.fee_receipt_number)}</span>
            </span>
          </div>
        </div>
      </div>

      {otherReceipts.length > 0 && (
        <div className="form-card-other-receipts">
          <h5 className="fee-details-card-title">歷史收據</h5>
          <div className="other-receipts-list">
            {otherReceipts.map((r, i) => (
              <div key={r.receiptId || i} className="other-receipt-item">
                <span>{displayAmount(r.amount)}</span>
                <span>No. {displayInvoiceNumber(r.invoiceNumber)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-card-handler-info">
        <div className="handler-info-grid">
          <span>
            <span className="billing-receipt-label">經手人</span>
            <span className="billing-receipt-value">{form.handled_by_name || '--'}</span>
          </span>
          <span>
            <span className="billing-receipt-label">報到日期</span>
            <span className="billing-receipt-value">{form.reported_on || '--'}</span>
          </span>
          <span>
            <span className="billing-receipt-label">登入帳號</span>
            <span className="billing-receipt-value">{form.handled_by_account || '--'}</span>
          </span>
        </div>
        {form.notes && (
          <div className="handler-notes-box" style={{ marginTop: '8px' }}>
            <span className="billing-receipt-label">備註</span>
            <p className="handler-notes-text">{form.notes}</p>
          </div>
        )}
        {form.refunded && form.refund_info && (
          <div className="handler-notes-box refund-info-box" style={{ marginTop: '8px' }}>
            <span className="billing-receipt-label">退費原因/備註</span>
            <p className="handler-notes-text">{form.refund_info}</p>
          </div>
        )}
      </div>
    </div>
  )
}
