import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { normalizeSeason } from '../../domain/season'
import { updateEnrollmentWithCourses } from '../../services/enrollmentService'
import CourseTagPicker from './CourseTagPicker'

export default function EnrollmentEditForm({ enrollment, onSave, onCancel }) {
  const [form, setForm] = useState({
    season: enrollment.season,
    reg_type: enrollment.reg_type,
    pre_test: enrollment.pre_test,
    post_test: enrollment.post_test,
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
      const normalizedSeason = normalizeSeason(form.season)
      if (!normalizedSeason) {
        alert('請輸入有效的季度，例如：第十六季')
        return
      }
      await updateEnrollmentWithCourses(
        supabase,
        enrollment.enrollment_id,
        { ...form, season: normalizedSeason },
      )

      alert('選課資料已更新')
      onSave()
    } catch (err) {
      setSaveError('伺服器錯誤: ' + err.message)
    }
  }

  return (
    <div className="enrollment-edit-form">
      <div className="form-group"><label className="form-label">修課期別</label><input type="text" className="form-input" value={form.season || ''} onChange={e => setForm({ ...form, season: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">新生/續生</label><select className="form-select" value={form.reg_type || ''} onChange={e => setForm({ ...form, reg_type: e.target.value })}><option value="">請選擇</option><option value="新">新生</option><option value="續">續生</option></select></div>
      <div className="form-group"><label className="form-label">前測分數</label><input type="text" className="form-input" value={form.pre_test || ''} onChange={e => setForm({ ...form, pre_test: e.target.value })} placeholder="(分數)(年/月/日)" /></div>
      <div className="form-group"><label className="form-label">後測分數</label><input type="text" className="form-input" value={form.post_test || ''} onChange={e => setForm({ ...form, post_test: e.target.value })} placeholder="(分數)(年/月/日)" /></div>
      <div className="form-group" style={{ gridColumn: 'span 2' }}>
        <CourseTagPicker
          selectedCourseNames={form.courses}
          lockedCourseNames={lockedCourseNames}
          onChange={courses => setForm(current => ({ ...current, courses }))}
          canManage
        />
      </div>
      <div className="form-group form-checkbox-group" style={{ gridColumn: 'span 2' }}><input type="checkbox" id={`edit-refunded-${enrollment.enrollment_id}`} className="form-checkbox" checked={!!form.refunded} onChange={e => setForm({ ...form, refunded: e.target.checked })} /><label htmlFor={`edit-refunded-${enrollment.enrollment_id}`} className="form-label" style={{ cursor: 'pointer' }}>標記為已退費</label></div>
      {!!form.refunded && <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">退費備註 / 原因</label><input type="text" className="form-input" value={form.refund_info || ''} onChange={e => setForm({ ...form, refund_info: e.target.value })} /></div>}
      {saveError && <div role="alert" style={{ gridColumn: 'span 2' }}>{saveError}</div>}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}><button type="button" className="btn-secondary" onClick={onCancel}>取消</button><button type="button" className="btn-primary" onClick={handleSave}>儲存</button></div>
    </div>
  )
}
