import { Activity, Edit2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { summarizeEnrollmentBilling } from '../../domain/enrollmentBilling'
import EnrollmentEditForm from './EnrollmentEditForm'

function BillingSummary({ enrollment }) {
  const billing = summarizeEnrollmentBilling(enrollment)
  const forms = Array.isArray(enrollment.forms) && enrollment.forms.length > 0
    ? (enrollment.forms.some(f => !f.refunded) ? enrollment.forms.filter(f => !f.refunded) : enrollment.forms)
    : null

  let hasPrepaid = false
  let prepaidTotal = 0
  let prepaidReceiptNo = ''
  let hasFormal = false
  let formalTotal = 0
  let feeReceiptNo = ''
  let handlerName = ''
  let handledOn = ''

  if (forms) {
    const prepaids = forms.map(f => f.prepaid_amount).filter(v => v != null)
    prepaidTotal = prepaids.reduce((a, b) => a + b, 0)
    const prepaidNos = forms.map(f => String(f.prepaid_receipt_number ?? '').trim()).filter(Boolean)
    prepaidReceiptNo = prepaidNos.join(', ')
    hasPrepaid = prepaids.length > 0 || prepaidNos.length > 0

    const formalForms = forms.filter(f => f.tuition_fee != null || f.materials_fee != null || f.membership_fee != null || Boolean(String(f.fee_receipt_number ?? '').trim()))
    formalTotal = forms.reduce((sum, f) => sum + (f.tuition_fee || 0) + (f.materials_fee || 0) + (f.membership_fee || 0), 0)
    const feeNos = forms.map(f => String(f.fee_receipt_number ?? '').trim()).filter(Boolean)
    feeReceiptNo = feeNos.join(', ')
    hasFormal = formalForms.length > 0 || feeNos.length > 0

    const handlers = forms.map(f => String(f.handled_by_name ?? '').trim()).filter(Boolean)
    handlerName = [...new Set(handlers)].join(', ')
    const dates = forms.map(f => f.reported_on || f.handled_on).filter(Boolean)
    handledOn = dates.length > 0 ? dates[dates.length - 1] : ''
  } else {
    hasPrepaid = enrollment.prepaid_amount != null || Boolean(String(enrollment.prepaid_receipt_number ?? '').trim())
    prepaidTotal = enrollment.prepaid_amount ?? 0
    prepaidReceiptNo = enrollment.prepaid_receipt_number
    hasFormal = enrollment.tuition_fee != null || enrollment.materials_fee != null || enrollment.membership_fee != null || Boolean(String(enrollment.fee_receipt_number ?? '').trim())
    formalTotal = (enrollment.tuition_fee || 0) + (enrollment.materials_fee || 0) + (enrollment.membership_fee || 0)
    feeReceiptNo = enrollment.fee_receipt_number
    handlerName = enrollment.handled_by_name
    handledOn = enrollment.reported_on || enrollment.handled_on
  }

  const hasAnyBreakdown = hasPrepaid || hasFormal
  const hasLegacy = billing.amount != null || billing.invoiceNumbers.length > 0
  const hasHandler = Boolean(handlerName || handledOn)

  if (!hasAnyBreakdown && !hasLegacy && !hasHandler) return null

  return (
    <div className="timeline-billing-summary" data-testid="timeline-billing-summary">
      <div className="timeline-billing-breakdown">
        {hasPrepaid && (
          <span className="breakdown-tag prepaid">
            預繳: NT$ {prepaidTotal} {prepaidReceiptNo ? `(No.${prepaidReceiptNo})` : ''}
          </span>
        )}
        {hasFormal && (
          <span className="breakdown-tag formal">
            正式: NT$ {formalTotal} {feeReceiptNo ? `(No.${feeReceiptNo})` : ''}
          </span>
        )}
        {!hasAnyBreakdown && hasLegacy && (
          <span className="breakdown-tag">
            {billing.amount == null ? '--' : `NT$ ${billing.amount}`} {billing.invoiceNumbers.length > 0 ? `(${billing.invoiceNumbers.join(', ')})` : ''}
          </span>
        )}
      </div>
      {hasHandler && (
        <span className="timeline-handler">
          經手: {handlerName || '未填'} {handledOn ? `(${handledOn})` : ''}
        </span>
      )}
    </div>
  )
}

function TimelineMeta({ item }) {
  const hasDates = item.period_start_date || item.period_end_date
  const formCount = item.formCount || item.forms?.length || 1
  const isRefunded = item.refundStatus === 'refunded' || item.refunded === true
  const isPartial = item.refundStatus === 'partial'

  return (
    <div className="timeline-meta">
      <div className="timeline-meta-header">
        <div className="timeline-period-group">
          <span className="timeline-period">{item.period}</span>
          {hasDates && (
            <span className="timeline-dates">
              {item.period_start_date || '--'} ~ {item.period_end_date || '--'}
            </span>
          )}
        </div>
        <div className="timeline-badges">
          {formCount > 1 && (
            <span className="timeline-form-count" style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-secondary, #e2e8f0)', color: 'var(--text-secondary, #475569)' }}>
              {formCount} 張報名表
            </span>
          )}
          {item.reg_type && <span className="timeline-reg-type">{item.reg_type === '新' ? '新生' : '續生'}</span>}
          {isRefunded && <span className="badge danger" style={{ padding: '1px 6px', fontSize: '10px' }}>已退費</span>}
          {isPartial && <span className="badge warning" style={{ padding: '1px 6px', fontSize: '10px' }}>部分退費</span>}
        </div>
      </div>
    </div>
  )
}

export default function EnrollmentTimeline({ timeline, onDelete, onAddEnrollment, onEditEnrollment = true, onRefresh, onSelectEnrollment }) {
  const [editingEnrollId, setEditingEnrollId] = useState(null)

  useEffect(() => {
    if (!onEditEnrollment) setEditingEnrollId(null)
  }, [onEditEnrollment])

  // 表單儲存後先收起內嵌編輯器，再交由外層 `onRefresh` 重新取得最新的報名時間軸。
  const handleSave = () => {
    setEditingEnrollId(null)
    if (onRefresh) onRefresh()
  }

  const handleCardClick = (item, trigger) => {
    if (editingEnrollId === item.enrollment_id) return
    onSelectEnrollment?.(item, trigger)
  }

  return (
    <div className="timeline-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="timeline-title" style={{ margin: 0 }}><Activity size={16} />歷年修課歷程 ({timeline.length} 期)</h3>
        {onAddEnrollment && <button type="button" className="btn-primary"  onClick={onAddEnrollment} id="btn-add-enrollment-modal"><span>+ 新增選課紀錄</span></button>}
      </div>
      {timeline.length > 0 ? (
        <div className="timeline-container">
          {timeline.map((item, idx) => (
            <div className={`timeline-item ${idx === timeline.length - 1 ? 'active' : ''} ${item.refundStatus === 'refunded' || item.refunded ? 'refunded' : ''}`} key={item.enrollment_id}>
              <div className="timeline-dot" />
              <div className={`timeline-card ${onEditEnrollment && editingEnrollId === item.enrollment_id ? 'is-editing' : ''} ${onEditEnrollment && onDelete ? 'has-two-actions' : ''}`}>
                {onEditEnrollment && editingEnrollId === item.enrollment_id ? <>
                  <TimelineMeta item={item} />
                  <EnrollmentEditForm enrollment={item} onSave={handleSave} onCancel={() => setEditingEnrollId(null)} />
                </> : <button
                  type="button"
                  className="timeline-card-select"
                  onClick={event => handleCardClick(item, event.currentTarget)}
                >
                  <TimelineMeta item={item} />
                  <div className="timeline-courses">{item.courses && item.courses.length > 0 ? item.courses.map(course => <span className="course-tag" key={course}>{course}</span>) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>無選課紀錄/僅進行測驗</span>}</div>
                  {item.notes && (
                    <div className="timeline-notes" title={item.notes}>
                      備註：{item.notes}
                    </div>
                  )}
                  <BillingSummary enrollment={item} />
                </button>}
                {editingEnrollId !== item.enrollment_id && (
                  <div className="timeline-actions">
                    {onEditEnrollment && (
                      <button
                        type="button"
                        className="timeline-action-btn"
                        onClick={() => setEditingEnrollId(item.enrollment_id)}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        type="button"
                        className="timeline-action-btn danger"
                        onClick={() => onDelete(item.enrollment_id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>無修課歷程</p>}
    </div>
  )
}
