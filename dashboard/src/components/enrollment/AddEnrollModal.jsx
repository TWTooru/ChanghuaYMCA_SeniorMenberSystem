import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { createEnrollmentWithCourses } from '../../services/enrollmentService'
import { normalizeSeason } from '../../domain/season'
import CourseTagPicker from './CourseTagPicker'
import '../common/common.css'

// 新增報名會連同課程以同一個 `createEnrollmentWithCourses` 請求儲存，成功後再透過 `onRefresh` 同步外層資料。
export default function AddEnrollModal({ student, onClose, onRefresh, defaultSeason = '第十五季' }) {
  const [newEnroll, setNewEnroll] = useState({
    season: defaultSeason, reg_type: '續', pre_test: '', post_test: '',
    refunded: false, refund_info: '', paid: false, amount: '', invoice_number: '', courses: []
  });

  const handleAddEnrollSubmit = (e) => {
    e.preventDefault();
    if (!student) return;
    const season = normalizeSeason(newEnroll.season)
    if (!season) {
      alert('請輸入有效的季度，例如：第十六季')
      return
    }
    
    if (newEnroll.courses.length === 0) {
      alert('請至少選擇一門課程')
      return
    }

    const insertEnrollment = async () => {
      try {
        await createEnrollmentWithCourses(supabase, student.student_id, { ...newEnroll, season });
        alert("選課新增成功！");
        if (onRefresh) onRefresh();
        onClose();
      } catch (err) {
        alert("伺服器錯誤: " + err.message);
      }
    };
    insertEnrollment();
  };

  if (!student) return null;

  return (
    <div className="modal-overlay-center" onClick={onClose} id="modal-add-enrollment-overlay">
      <div className="form-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header-centered">
          <h2>新增選課紀錄</h2>
          <button 
            type="button"
            className="btn-close" 
            onClick={onClose}
            id="btn-close-add-enrollment"
          >
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleAddEnrollSubmit} className="form-grid">
          <div className="form-group">
            <label className="form-label">學員姓名</label>
            <input 
              type="text" 
              className="form-input" 
              value={student.name} 
              disabled 
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label">學員 ID</label>
            <input 
              type="text" 
              className="form-input" 
              value={student.student_id} 
              disabled 
              style={{ opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="enrollment-season">修課季度 *</label>
            <input 
              id="enrollment-season"
              type="text" 
              className="form-input" 
              value={newEnroll.season} 
              onChange={e => setNewEnroll({...newEnroll, season: e.target.value})} 
              required
              placeholder="例如：第十六季"
            />
          </div>
          <div className="form-group">
            <label className="form-label">新/續生</label>
            <select 
              className="form-select" 
              value={newEnroll.reg_type} 
              onChange={e => setNewEnroll({...newEnroll, reg_type: e.target.value})}
            >
              <option value="新">新</option>
              <option value="續">續</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">前測分數</label>
            <input 
              type="text" 
              className="form-input" 
              value={newEnroll.pre_test} 
              onChange={e => setNewEnroll({...newEnroll, pre_test: e.target.value})} 
              placeholder="(分數)(年/月/日)"
            />
          </div>
          <div className="form-group">
            <label className="form-label">後測分數</label>
            <input 
              type="text" 
              className="form-input" 
              value={newEnroll.post_test} 
              onChange={e => setNewEnroll({...newEnroll, post_test: e.target.value})} 
              placeholder="(分數)(年/月/日)"
            />
          </div>
          <div className="form-group full-width">
            <span className="form-label">選修課程 *</span>
            <CourseTagPicker
              selectedCourseNames={newEnroll.courses}
              lockedCourseNames={[]}
              onChange={courses => setNewEnroll(current => ({ ...current, courses }))}
              canManage
            />
          </div>
          <div className="form-group form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              id="refunded-checkbox"
              checked={newEnroll.refunded} 
              onChange={e => setNewEnroll({...newEnroll, refunded: e.target.checked})} 
            />
            <label className="form-label" htmlFor="refunded-checkbox" style={{ cursor: 'pointer' }}>是否已退費</label>
          </div>
          <div className="form-group form-checkbox-group">
            <input 
              type="checkbox" 
              className="form-checkbox"
              id="paid-checkbox"
              checked={newEnroll.paid} 
              onChange={e => setNewEnroll({...newEnroll, paid: e.target.checked})} 
            />
            <label className="form-label" htmlFor="paid-checkbox" style={{ cursor: 'pointer' }}>是否已繳費</label>
          </div>
          <div className="form-group">
            {newEnroll.refunded && (
              <>
                <label className="form-label">退費原因/備註</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={newEnroll.refund_info} 
                  onChange={e => setNewEnroll({...newEnroll, refund_info: e.target.value})} 
                  placeholder="例如: 因身體不適退費"
                />
              </>
            )}
          </div>
          {newEnroll.paid && (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="paid-amount">繳費金額</label>
                <input 
                  id="paid-amount"
                  type="number" 
                  className="form-input" 
                  value={newEnroll.amount} 
                  onChange={e => setNewEnroll({...newEnroll, amount: e.target.value})} 
                  placeholder="例如: 3000"
                  min="0"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="paid-invoice-number">發票編號</label>
                <input 
                  id="paid-invoice-number"
                  type="text" 
                  className="form-input" 
                  value={newEnroll.invoice_number} 
                  onChange={e => setNewEnroll({...newEnroll, invoice_number: e.target.value})} 
                  placeholder="例如: AB12345678"
                />
              </div>
            </>
          )}
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
              新增選課
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
