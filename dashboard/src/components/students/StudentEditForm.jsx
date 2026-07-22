import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { updateStudent } from '../../services/studentService'

export default function StudentEditForm({ student, onSave, onCancel, onDirtyChange = () => {} }) {
  const initialForm = useMemo(() => ({ ...student }), [student])
  const [editForm, setEditForm] = useState(initialForm)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const isDirty = JSON.stringify(editForm) !== JSON.stringify(initialForm)

  useEffect(() => {
    onDirtyChange(isDirty)
    return () => onDirtyChange(false)
  }, [isDirty, onDirtyChange])

  const handleFormChange = (event) => {
    const { name, value } = event.target
    const newForm = { ...editForm, [name]: value }
    if (name === 'birth_date' && value) {
      const calculatedAge = new Date().getFullYear() - new Date(value).getFullYear()
      newForm.age = calculatedAge
      newForm.is_60_plus = calculatedAge >= 60 ? '是' : '否'
    }
    setEditForm(newForm)
  }

  const handleSave = async () => {
    setIsSaving(true)
    setSaveError('')
    try {
      const payload = {
        ...editForm,
        age: editForm.age ? parseInt(editForm.age, 10) : null,
        is_60_plus: editForm.age && parseInt(editForm.age, 10) >= 60 ? '是' : '否',
      }
      await updateStudent(supabase, student.student_id, payload)
      onDirtyChange(false)
      onSave()
    } catch (error) {
      setSaveError(error.message || '學員資料更新失敗')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="form-grid" style={{ padding: '0', background: 'transparent' }}>
      <h3 className="student-edit-section-title">身分資料</h3>
      <div className="form-group"><label className="form-label">學員編號 (唯讀)</label><input type="text" className="form-input" value={editForm.student_id || ''} readOnly disabled /></div>
      <div className="form-group"><label className="form-label">姓名</label><input type="text" className="form-input" name="name" value={editForm.name || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">性別</label><select className="form-select" name="gender" value={editForm.gender || ''} onChange={handleFormChange} disabled={isSaving}><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></div>
      <div className="form-group"><label className="form-label">出生日期</label><input type="date" className="form-input" name="birth_date" value={editForm.birth_date || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">年齡 (自動)</label><input type="number" className="form-input" value={editForm.age || ''} readOnly disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">是否達60歲 (自動)</label><input type="text" className="form-input" value={editForm.is_60_plus || ''} readOnly disabled={isSaving} /></div>

      <h3 className="student-edit-section-title">聯絡資料</h3>
      <div className="form-group"><label className="form-label">手機電話</label><input type="text" className="form-input" name="mobile_phone" value={editForm.mobile_phone || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">市話號碼</label><input type="text" className="form-input" name="home_phone" value={editForm.home_phone || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group full-width"><label className="form-label">通訊地址</label><input type="text" className="form-input" name="address" value={editForm.address || ''} onChange={handleFormChange} disabled={isSaving} /></div>

      <h3 className="student-edit-section-title">緊急聯絡</h3>
      <div className="form-group"><label className="form-label">緊急聯絡人</label><input type="text" className="form-input" name="emergency_contact" value={editForm.emergency_contact || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">緊急聯絡人關係</label><input type="text" className="form-input" name="relationship" value={editForm.relationship || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group full-width"><label className="form-label">緊急聯絡人電話</label><input type="text" className="form-input" name="emergency_contact_phone" value={editForm.emergency_contact_phone || ''} onChange={handleFormChange} disabled={isSaving} /></div>

      <h3 className="student-edit-section-title">其他資料</h3>
      <div className="form-group"><label className="form-label">教育程度</label><input type="text" className="form-input" name="education" value={editForm.education || ''} onChange={handleFormChange} disabled={isSaving} /></div>
      <div className="form-group"><label className="form-label">職業</label><input type="text" className="form-input" name="occupation" value={editForm.occupation || ''} onChange={handleFormChange} disabled={isSaving} /></div>

      {saveError && <p className="student-edit-error" role="alert">{saveError}</p>}
      <div className="form-group full-width student-edit-actions"><button type="button" className="btn-secondary" onClick={onCancel} disabled={isSaving}>取消</button><button type="button" className="btn-primary" onClick={handleSave} disabled={isSaving}>{isSaving ? '儲存中…' : '儲存變更'}</button></div>
    </div>
  )
}
