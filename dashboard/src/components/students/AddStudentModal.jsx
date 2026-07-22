import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'
import { createStudent } from '../../services/studentService'

export default function AddStudentModal({ students, onClose, onRefresh }) {
  const [newStudent, setNewStudent] = useState({
    student_id: '', name: '', gender: '男', birth_date: '', age: '',
    address: '', mobile_phone: '', home_phone: '', emergency_contact: '',
    relationship: '', emergency_contact_phone: '', education: '大專/大學', occupation: ''
  });

  const suggestNextStudentId = () => {
    if (!students || students.length === 0) return 1;
    let maxNum = 0;
    students.forEach(s => {
      const num = parseInt(s.student_id, 10);
      if (!isNaN(num) && num > maxNum) {
        maxNum = num;
      }
    });
    return maxNum + 1;
  };

  useEffect(() => {
    setNewStudent(prev => ({ ...prev, student_id: suggestNextStudentId() }));
  }, [students]);

  const handleBirthDateChange = (val) => {
    let calculatedAge = '';
    if (val) {
      const birthYear = new Date(val).getFullYear();
      const currentYear = new Date().getFullYear();
      if (!isNaN(birthYear) && birthYear <= currentYear) {
        calculatedAge = currentYear - birthYear;
      }
    }
    setNewStudent(prev => ({
      ...prev,
      birth_date: val,
      age: calculatedAge !== '' ? String(calculatedAge) : prev.age
    }));
  };

  const handleAddStudentSubmit = (e) => {
    e.preventDefault();
    if (!newStudent.student_id || !newStudent.name) {
      alert("學員 ID 與姓名為必填欄位！");
      return;
    }
    
    const ageParsed = newStudent.age ? parseInt(newStudent.age, 10) : null;
    const bodyData = {
      ...newStudent,
      age: ageParsed,
      is_60_plus: (ageParsed && ageParsed >= 60) ? '是' : '否'
    };

    const insertStudent = async () => {
      try {
        await createStudent(supabase, bodyData);
        alert("新增成功！");
        if (onRefresh) onRefresh();
        onClose();
      } catch (err) {
        alert(err.message);
      }
    };
    insertStudent();
  };

  return (
    <div className="modal-overlay-center" onClick={onClose} id="modal-add-student-overlay">
      <div className="form-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-centered">
          <h2>手動新增學員</h2>
          <button 
            type="button"
            className="btn-close" 
            onClick={onClose}
            id="btn-close-add-student"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleAddStudentSubmit} className="form-grid">
          <div className="form-group">
            <label className="form-label">學員 ID * (自動建議)</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.student_id} 
              onChange={e => setNewStudent({...newStudent, student_id: e.target.value})} 
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">姓名 *</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.name} 
              onChange={e => setNewStudent({...newStudent, name: e.target.value})} 
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">性別</label>
            <select 
              className="form-select" 
              value={newStudent.gender} 
              onChange={e => setNewStudent({...newStudent, gender: e.target.value})}
            >
              <option value="男">男</option>
              <option value="女">女</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">出生日期</label>
            <input 
              type="date" 
              className="form-input" 
              value={newStudent.birth_date} 
              onChange={e => handleBirthDateChange(e.target.value)} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">年齡 (由出生日期估算)</label>
            <input 
              type="number" 
              className="form-input" 
              value={newStudent.age} 
              onChange={e => setNewStudent({...newStudent, age: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">教育程度</label>
            <select 
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
            <label className="form-label">職業</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.occupation} 
              onChange={e => setNewStudent({...newStudent, occupation: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">手機電話</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.mobile_phone} 
              onChange={e => setNewStudent({...newStudent, mobile_phone: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">市話號碼</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.home_phone} 
              onChange={e => setNewStudent({...newStudent, home_phone: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">緊急聯絡人</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.emergency_contact} 
              onChange={e => setNewStudent({...newStudent, emergency_contact: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">緊急聯絡人關係</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.relationship} 
              onChange={e => setNewStudent({...newStudent, relationship: e.target.value})} 
            />
          </div>
          <div className="form-group">
            <label className="form-label">緊急聯絡人電話</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.emergency_contact_phone} 
              onChange={e => setNewStudent({...newStudent, emergency_contact_phone: e.target.value})} 
            />
          </div>
          <div className="form-group full-width">
            <label className="form-label">通訊地址</label>
            <input 
              type="text" 
              className="form-input" 
              value={newStudent.address} 
              onChange={e => setNewStudent({...newStudent, address: e.target.value})} 
            />
          </div>
          <div className="form-footer full-width">
            <button 
              type="button" 
              className="btn-secondary" 
              onClick={onClose}
            >
              取消
            </button>
            <button 
              type="submit" 
              className="btn-primary"
            >
              新增學員
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
