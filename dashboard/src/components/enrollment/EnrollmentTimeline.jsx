import { Activity, Edit2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { summarizeEnrollmentBilling } from '../../domain/enrollmentBilling'
import EnrollmentEditForm from './EnrollmentEditForm'

function BillingSummary({ enrollment }) {
  const billing = summarizeEnrollmentBilling(enrollment)
  const amountText = billing.amount == null ? '--' : `NT$ ${billing.amount}`
  const invoiceText = billing.invoiceNumbers.length > 0
    ? billing.invoiceNumbers.join(', ')
    : '--'

  return (
    <div className="timeline-billing-summary" data-testid="timeline-billing-summary">
      <span>{amountText}</span>
      <span>{invoiceText}</span>
    </div>
  )
}

function TimelineMeta({ item }) {
  return (
    <div className="timeline-meta">
      <span className="timeline-period">{item.period}</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        {item.reg_type && <span className="timeline-reg-type">{item.reg_type === '新' ? '新生' : '續生'}</span>}
        {item.refunded && <span className="badge danger" style={{ padding: '1px 6px', fontSize: '10px' }}>已退費</span>}
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

  const handleCardClick = (item) => {
    if (editingEnrollId === item.enrollment_id) return
    onSelectEnrollment?.(item)
  }

  return (
    <div className="timeline-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="timeline-title" style={{ margin: 0 }}><Activity size={16} />歷年修課歷程 ({timeline.length} 期)</h3>
        {onAddEnrollment && <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={onAddEnrollment} id="btn-add-enrollment-modal"><span>+ 新增選課紀錄</span></button>}
      </div>
      {timeline.length > 0 ? (
        <div className="timeline-container">
          {timeline.map((item, idx) => (
            <div className={`timeline-item ${idx === timeline.length - 1 ? 'active' : ''} ${item.refunded ? 'refunded' : ''}`} key={item.enrollment_id}>
              <div className="timeline-dot" />
              <div className="timeline-card">
                {onEditEnrollment && editingEnrollId === item.enrollment_id ? <>
                  <TimelineMeta item={item} />
                  <EnrollmentEditForm enrollment={item} onSave={handleSave} onCancel={() => setEditingEnrollId(null)} />
                </> : <button
                  type="button"
                  className="timeline-card-select"
                  onClick={() => handleCardClick(item)}
                >
                  <TimelineMeta item={item} />
                  <div className="timeline-courses">{item.courses && item.courses.length > 0 ? item.courses.map(course => <span className="course-tag" key={course}>{course}</span>) : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>無選課紀錄/僅進行測驗</span>}</div>
                  <BillingSummary enrollment={item} />
                </button>}
                <div className="timeline-actions">{onEditEnrollment && <button type="button" className="timeline-action-btn" onClick={() => setEditingEnrollId(item.enrollment_id)}><Edit2 size={14} /></button>}{onDelete && <button type="button" className="timeline-action-btn danger" onClick={() => onDelete(item.enrollment_id)}><Trash2 size={14} /></button>}</div>
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>無修課歷程</p>}
    </div>
  )
}
