import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { normalizeSeason } from '../../domain/season'

export default function EnrollmentEditForm({ enrollment, onSave, onCancel }) {
  const [form, setForm] = useState({
    season: enrollment.season,
    reg_type: enrollment.reg_type,
    pre_test: enrollment.pre_test,
    post_test: enrollment.post_test,
    refunded: enrollment.refunded,
    refund_info: enrollment.refund_info,
    courses: (enrollment.courses || []).join(', ')
  })

  const handleSave = async () => {
    try {
      const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
      const normalizedSeason = normalizeSeason(season)
      if (!normalizedSeason) {
        alert('請輸入有效的季度，例如：第十六季')
        return
      }
      const { error } = await supabase.from('enrollments')
        .update({ season: normalizedSeason, reg_type, pre_test, post_test, refunded: refunded ? 1 : 0, refund_info })
        .eq('enrollment_id', enrollment.enrollment_id)
      if (error) throw error

      const { data: oldCourses, error: fetchError } = await supabase.from('courses').select('*').eq('enrollment_id', enrollment.enrollment_id)
      if (fetchError) throw fetchError
      await supabase.from('courses').delete().eq('enrollment_id', enrollment.enrollment_id)
      try {
        if (courses && courses.trim()) {
          const courseList = courses.split(/[,，]/).map(course => course.trim()).filter(Boolean)
          if (courseList.length > 0) {
            const { error: insertError } = await supabase.from('courses').insert(courseList.map(course_name => ({ enrollment_id: enrollment.enrollment_id, course_name })))
            if (insertError) throw insertError
          }
        }
      } catch (insertErr) {
        if (oldCourses && oldCourses.length > 0) await supabase.from('courses').insert(oldCourses.map(course => ({ enrollment_id: course.enrollment_id, course_name: course.course_name })))
        throw new Error(`課程更新失敗，已還原原課程設定。(${insertErr.message})`)
      }

      alert('選課資料已更新')
      onSave()
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }

  return (
    <div className="enrollment-edit-form">
      <div className="form-group"><label className="form-label">修課期別</label><input type="text" className="form-input" value={form.season || ''} onChange={e => setForm({ ...form, season: e.target.value })} /></div>
      <div className="form-group"><label className="form-label">新生/續生</label><select className="form-select" value={form.reg_type || ''} onChange={e => setForm({ ...form, reg_type: e.target.value })}><option value="">請選擇</option><option value="新">新生</option><option value="續">續生</option></select></div>
      <div className="form-group"><label className="form-label">前測分數</label><input type="text" className="form-input" value={form.pre_test || ''} onChange={e => setForm({ ...form, pre_test: e.target.value })} placeholder="(分數)(年/月/日)" /></div>
      <div className="form-group"><label className="form-label">後測分數</label><input type="text" className="form-input" value={form.post_test || ''} onChange={e => setForm({ ...form, post_test: e.target.value })} placeholder="(分數)(年/月/日)" /></div>
      <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">修讀課程 (以逗號分隔)</label><input type="text" className="form-input" value={form.courses || ''} onChange={e => setForm({ ...form, courses: e.target.value })} /></div>
      <div className="form-group form-checkbox-group" style={{ gridColumn: 'span 2' }}><input type="checkbox" id={`edit-refunded-${enrollment.enrollment_id}`} className="form-checkbox" checked={!!form.refunded} onChange={e => setForm({ ...form, refunded: e.target.checked })} /><label htmlFor={`edit-refunded-${enrollment.enrollment_id}`} className="form-label" style={{ cursor: 'pointer' }}>標記為已退費</label></div>
      {form.refunded && <div className="form-group" style={{ gridColumn: 'span 2' }}><label className="form-label">退費備註 / 原因</label><input type="text" className="form-input" value={form.refund_info || ''} onChange={e => setForm({ ...form, refund_info: e.target.value })} /></div>}
      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}><button type="button" className="btn-secondary" onClick={onCancel}>取消</button><button type="button" className="btn-primary" onClick={handleSave}>儲存</button></div>
    </div>
  )
}
