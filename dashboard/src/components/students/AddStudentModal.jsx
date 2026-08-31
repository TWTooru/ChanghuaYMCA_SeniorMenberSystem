import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import { createStudent } from '../../services/studentService'
import { STUDENT_ID_VALIDATION_MESSAGE, normalizeStudentId } from '../../domain/studentIdentity'
import { Button } from '../ui/button'
import { Dialog, DialogClose, DialogContent, DialogTitle } from '../ui/dialog'
import '../common/common.css'

export default function AddStudentModal({ students, onClose, onRefresh }) {
  /** 建立學員時以既有數字 ID 推算下一個建議值；無法正規化的舊版 ID 不參與計算。 */
  const [newStudent, setNewStudent] = useState({
    student_id: '', name: '', gender: '男', birth_date: '', age: '',
    address: '', mobile_phone: '', home_phone: '', emergency_contact: '',
    relationship: '', emergency_contact_phone: '', education: '大專/大學', occupation: ''
  })

  const suggestNextStudentId = useCallback(() => {
    let maximum = 0n
    for (const student of students || []) {
      try {
        const value = BigInt(normalizeStudentId(student.student_id))
        if (value > maximum) maximum = value
      // 無法正規化的舊版 ID 會略過，避免舊資料阻斷新學員編號的建議值。
      } catch { /* 無法正規化的舊版 ID 會略過。 */ }
    }
    return String(maximum + 1n)
  }, [students])

  useEffect(() => {
    setNewStudent(prev => ({ ...prev, student_id: suggestNextStudentId() }))
  }, [suggestNextStudentId])

  const handleBirthDateChange = (val) => {
    let calculatedAge = ''
    if (val) {
      const birthYear = new Date(val).getFullYear()
      const currentYear = new Date().getFullYear()
      if (!isNaN(birthYear) && birthYear <= currentYear) {
        calculatedAge = currentYear - birthYear
      }
    }
    setNewStudent(prev => ({
      ...prev,
      birth_date: val,
      age: calculatedAge !== '' ? String(calculatedAge) : prev.age
    }))
  }

  const handleAddStudentSubmit = (e) => {
    e.preventDefault()
    let normalizedStudentId
    try {
      normalizedStudentId = normalizeStudentId(newStudent.student_id)
    } catch {
      alert(STUDENT_ID_VALIDATION_MESSAGE)
      return
    }
    if (!String(newStudent.name || '').trim()) {
      alert("學員 ID 與姓名為必填欄位！")
      return
    }
    
    const ageParsed = newStudent.age ? parseInt(newStudent.age, 10) : null
    const bodyData = {
      ...newStudent,
      student_id: normalizedStudentId,
      name: String(newStudent.name).trim(),
      age: ageParsed,
      is_60_plus: (ageParsed && ageParsed >= 60) ? '是' : '否'
    }

    const insertStudent = async () => {
      try {
        await createStudent(supabase, bodyData)
        alert("新增成功！")
        if (onRefresh) onRefresh()
        onClose()
      } catch (err) {
        alert(err.message)
      }
    }
    insertStudent()
  }

  const handleOpenChange = (open) => {
    if (!open) {
      onClose?.()
    }
  }

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="form-modal-content"
        id="modal-add-student-overlay"
        aria-labelledby="add-student-title"
      >
        <div className="modal-header-centered">
          <DialogTitle id="add-student-title">手動新增學員</DialogTitle>
          <DialogClose
            className="btn-close"
            id="btn-close-add-student"
            aria-label="關閉新增學員"
          >
            <X size={20} />
          </DialogClose>
        </div>
        <form onSubmit={handleAddStudentSubmit} className="form-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-id">學員 ID * (自動建議)</label>
            <input 
              id="new-student-id"
              type="text" 
              className="form-input" 
              value={newStudent.student_id} 
              onChange={e => setNewStudent({...newStudent, student_id: e.target.value})} 
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-name">姓名 *</label>
            <input 
              id="new-student-name"
              type="text" 
              className="form-input" 
              value={newStudent.name} 
              onChange={e => setNewStudent({...newStudent, name: e.target.value})} 
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-gender">性別</label>
            <select 
              id="new-student-gender"
              className="form-select" 
              value={newStudent.gender} 
              onChange={e => setNewStudent({...newStudent, gender: e.target.value})}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-birth">出生日期</label>
            <input 
              id="new-student-birth"
              type="date" 
              className="form-input" 
              value={newStudent.birth_date} 
              onChange={e => handleBirthDateChange(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-age">年齡 (由出生日期估算)</label>
            <input 
              id="new-student-age"
              type="number" 
              className="form-input" 
              value={newStudent.age} 
              onChange={e => setNewStudent({...newStudent, age: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-education">教育程度</label>
            <select 
              id="new-student-education"
              className="form-select" 
              value={newStudent.education} 
              onChange={e => setNewStudent({...newStudent, education: e.target.value})}
            >
              {EDUCATION_OPTIONS.map(option => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-occupation">職業</label>
            <input 
              id="new-student-occupation"
              type="text" 
              className="form-input" 
              value={newStudent.occupation} 
              onChange={e => setNewStudent({...newStudent, occupation: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-mobile">手機電話</label>
            <input 
              id="new-student-mobile"
              type="text" 
              className="form-input" 
              value={newStudent.mobile_phone} 
              onChange={e => setNewStudent({...newStudent, mobile_phone: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-home">市話號碼</label>
            <input 
              id="new-student-home"
              type="text" 
              className="form-input" 
              value={newStudent.home_phone} 
              onChange={e => setNewStudent({...newStudent, home_phone: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-emergency-contact">緊急聯絡人</label>
            <input 
              id="new-student-emergency-contact"
              type="text" 
              className="form-input" 
              value={newStudent.emergency_contact} 
              onChange={e => setNewStudent({...newStudent, emergency_contact: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-relationship">緊急聯絡人關係</label>
            <input 
              id="new-student-relationship"
              type="text" 
              className="form-input" 
              value={newStudent.relationship} 
              onChange={e => setNewStudent({...newStudent, relationship: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="new-student-emergency-phone">緊急聯絡人電話</label>
            <input 
              id="new-student-emergency-phone"
              type="text" 
              className="form-input" 
              value={newStudent.emergency_contact_phone} 
              onChange={e => setNewStudent({...newStudent, emergency_contact_phone: e.target.value})} 
            />
          </div>
          <div className="form-group full-width">
            <label className="form-label" htmlFor="new-student-address">通訊地址</label>
            <input 
              id="new-student-address"
              type="text" 
              className="form-input" 
              value={newStudent.address} 
              onChange={e => setNewStudent({...newStudent, address: e.target.value})} 
            />
          </div>
          <div className="form-footer full-width">
            <Button 
              type="button" 
              variant="secondary"
              className="btn-secondary" 
              onClick={onClose}
            >
              取消
            </Button>
            <Button 
              type="submit" 
              className="btn-primary"
            >
              新增學員
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
