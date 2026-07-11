import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function StudentEditForm({ student, onSave, onCancel }) {
  const [editForm, setEditForm] = useState({ ...student })

  const handleFormChange = (e) => {
    const { name, value } = e.target
    const newForm = { ...editForm, [name]: value }
    if (name === 'birth_date' && value) {
      const calculatedAge = new Date().getFullYear() - new Date(value).getFullYear()
      newForm.age = calculatedAge
      newForm.is_60_plus = calculatedAge >= 60 ? '是' : '否'
    }
    setEditForm(newForm)
  }

  const handleSave = async () => {
    try {
      const { error } = await supabase
        .from('students')
        .update({
          ...editForm,
          age: editForm.age ? parseInt(editForm.age, 10) : null,
          is_60_plus: editForm.age && parseInt(editForm.age, 10) >= 60 ? '是' : '否'
        })
        .eq('student_id', student.student_id)
      if (error) alert(error.message)
      else {
        alert('學員資料已更新')
        onSave()
      }
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }

  return (
    <div className="form-grid" style={{ padding: '0', background: 'transparent' }}>
      <div className="form-group"><label className="form-label">學員編號 (唯讀)</label><input type="text" className="form-input" value={editForm.student_id || ''} readOnly disabled /></div>
      <div className="form-group"><label className="form-label">姓名</label><input type="text" className="form-input" name="name" value={editForm.name || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">性別</label><select className="form-select" name="gender" value={editForm.gender || ''} onChange={handleFormChange}><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></div>
      <div className="form-group"><label className="form-label">出生日期</label><input type="date" className="form-input" name="birth_date" value={editForm.birth_date || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">年齡 (自動)</label><input type="number" className="form-input" value={editForm.age || ''} readOnly /></div>
      <div className="form-group"><label className="form-label">是否達60歲 (自動)</label><input type="text" className="form-input" value={editForm.is_60_plus || ''} readOnly /></div>
      <div className="form-group"><label className="form-label">教育程度</label><input type="text" className="form-input" name="education" value={editForm.education || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">職業</label><input type="text" className="form-input" name="occupation" value={editForm.occupation || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">手機電話</label><input type="text" className="form-input" name="mobile_phone" value={editForm.mobile_phone || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">市話號碼</label><input type="text" className="form-input" name="home_phone" value={editForm.home_phone || ''} onChange={handleFormChange} /></div>
      <div className="form-group full-width"><label className="form-label">通訊地址</label><input type="text" className="form-input" name="address" value={editForm.address || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">緊急聯絡人</label><input type="text" className="form-input" name="emergency_contact" value={editForm.emergency_contact || ''} onChange={handleFormChange} /></div>
      <div className="form-group"><label className="form-label">緊急聯絡人關係</label><input type="text" className="form-input" name="relationship" value={editForm.relationship || ''} onChange={handleFormChange} /></div>
      <div className="form-group full-width"><label className="form-label">緊急聯絡人電話</label><input type="text" className="form-input" name="emergency_contact_phone" value={editForm.emergency_contact_phone || ''} onChange={handleFormChange} /></div>
      <div className="form-group full-width" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}><button type="button" className="btn-secondary" onClick={onCancel}>取消</button><button type="button" className="btn-primary" onClick={handleSave}>儲存變更</button></div>
    </div>
  )
}
