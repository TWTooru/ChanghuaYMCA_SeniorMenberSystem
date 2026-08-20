import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { normalizePeriod, periodNumber } from '../../domain/period'
import { updateEnrollmentWithCourses } from '../../services/enrollmentService'
import CourseTagPicker from './CourseTagPicker'

export default function EnrollmentEditForm({ enrollment, onSave, onCancel }) {
  const initialPeriodNum = periodNumber(enrollment.period)
  const [form, setForm] = useState({
    period: initialPeriodNum > 0 ? String(initialPeriodNum) : (enrollment.period || ''),
    reg_type: enrollment.reg_type,
    refunded: enrollment.refunded,
    refund_info: enrollment.refund_info,
    courses: enrollment.courses || [],
  })
  const [saveError, setSaveError] = useState('')
  // 已建立收據的課程不可在編輯表單移除；`updateEnrollmentWithCourses` 需保留這些課程才能維持收據關聯。
  const lockedCourseNames = (enrollment.courseDetails || [])
    .filter(course => course.billingReceiptId != null || course.receipt)
    .map(course => course.courseName)

  const handleSave = async () => {
    setSaveError('')
    try {
      const normalizedPeriod = normalizePeriod(form.period)
      if (!normalizedPeriod) {
        alert('請輸入有效的期別，例如：第16期')
        return
      }
      await updateEnrollmentWithCourses(
        supabase,
        enrollment.enrollment_id,
        { ...form, period: normalizedPeriod },
      )

      alert('選課資料已更新')
      onSave()
    } catch (err) {
      setSaveError('伺服器錯誤: ' + err.message)
    }
  }

  return (
    <div className="enrollment-edit-form">
      <div className="form-group">
        <label className="form-label" htmlFor="edit-enrollment-period">修課期別</label>
        <div className="period-input-group">
          <span className="period-prefix">第</span>
          <input
            id="edit-enrollment-period"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="form-input period-number-input"
            placeholder="16"
            value={form.period || ''}
            onChange={e => setForm({ ...form, period: e.target.value })}
          />
          <span className="period-suffix">期</span>
        </div>
      </div>
      <div className="form-group"><label className="form-label">新生/續生</label><select className="form-select" value={form.reg_type || ''} onChange={e => setForm({ ...form, reg_type: e.target.value })}><option value="">請選擇</option><option value="新">新生</option><option value="續">續生</option></select></div>
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <CourseTagPicker
          selectedCourseNames={form.courses}
          lockedCourseNames={lockedCourseNames}
          onChange={courses => setForm(current => ({ ...current, courses }))}
        />
      </div>
      <div className="form-group form-checkbox-group" style={{ gridColumn: 'span 2' }}><input type="checkbox" id={`edit-refunded-${enrollment.enrollment_id}`} className="form-checkbox" checked={!!form.refunded} onChange={e => setForm({ ...form, refunded: e.target.checked })} /><label htmlFor={`edit-refunded-${enrollment.enrollment_id}`} className="form-label" style={{ cursor: 'pointer' }}>標記為已退費</label></div>
      {!!form.refunded && <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">退費備註 / 原因</label><input type="text" className="form-input" value={form.refund_info || ''} onChange={e => setForm({ ...form, refund_info: e.target.value })} /></div>}
      {saveError && <div role="alert" style={{ gridColumn: 'span 2' }}>{saveError}</div>}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}><button type="button" className="btn-secondary" onClick={onCancel}>取消</button><button type="button" className="btn-primary" onClick={handleSave}>儲存</button></div>
    </div>
  )
}
