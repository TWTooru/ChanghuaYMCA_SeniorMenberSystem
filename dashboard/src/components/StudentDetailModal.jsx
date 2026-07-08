import { useState, useMemo } from 'react'
import { X, User, Activity, Edit2, Trash2 } from 'lucide-react'
import ConfirmDialog from './ConfirmDialog'
import { supabase } from '../lib/supabaseClient'

export default function StudentDetailModal({ student, enrollments, onClose, onAddEnrollment, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({})
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const [editingEnrollId, setEditingEnrollId] = useState(null)
  const [enrollEditForm, setEnrollEditForm] = useState({})
  const [showDeleteEnrollConfirm, setShowDeleteEnrollConfirm] = useState(null)

  const studentTimeline = useMemo(() => {
    if (!student || !enrollments) return []
    return enrollments
      .filter(e => e.student_name === student.name)
      .sort((a, b) => {
        const seasonsOrder = [
          '第一季', '第二季', '第三季', '第四季', '第五季', 
          '第六季', '第七季', '第八季', '第九季', '第十期', 
          '第十一期', '第十二期', '第十三期', '第十四期', '第十五期'
        ]
        return seasonsOrder.indexOf(a.season) - seasonsOrder.indexOf(b.season)
      })
  }, [student, enrollments])

  if (!student) return null;

  const handleEditClick = () => {
    setIsEditing(true)
    setEditForm({ ...student })
  }

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let newForm = { ...editForm, [name]: value };
    
    if (name === 'birth_date' && value) {
      const birthYear = new Date(value).getFullYear();
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - birthYear;
      newForm.age = calculatedAge;
      newForm.is_60_plus = calculatedAge >= 60 ? '是' : '否';
    }
    
    setEditForm(newForm);
  }

  const handleSaveStudent = async () => {
    try {
      const { error } = await supabase
        .from('students')
        .update({
          ...editForm,
          age: editForm.age ? parseInt(editForm.age, 10) : null,
          is_60_plus: editForm.age && parseInt(editForm.age, 10) >= 60 ? '是' : '否'
        })
        .eq('student_id', student.student_id);

      if (error) {
        alert(error.message);
      } else {
        alert('學員資料已更新');
        if (onRefresh) onRefresh();
        setIsEditing(false);
      }
    } catch (err) {
      alert('伺服器錯誤: ' + err.message);
    }
  }

  const handleDeleteStudent = async () => {
    try {
      const { data: enrolls } = await supabase.from('enrollments').select('enrollment_id').eq('student_id', student.student_id);
      if (enrolls && enrolls.length > 0) {
        const enrollIds = enrolls.map(e => e.enrollment_id);
        await supabase.from('courses').delete().in('enrollment_id', enrollIds);
      }
      await supabase.from('enrollments').delete().eq('student_id', student.student_id);
      const { error } = await supabase.from('students').delete().eq('student_id', student.student_id);
      if (error) throw error;
      alert('學員已刪除'); 
      if (onRefresh) onRefresh(); 
      onClose();
    } catch (err) {
      alert('伺服器錯誤: ' + err.message);
    }
  }

  const handleEditEnrollment = (item) => {
    setEditingEnrollId(item.enrollment_id);
    setEnrollEditForm({
      season: item.season,
      reg_type: item.reg_type,
      pre_test: item.pre_test,
      post_test: item.post_test,
      refunded: item.refunded,
      refund_info: item.refund_info,
      courses: item.courses.join(', ')
    });
  }

  const handleSaveEnrollment = async (enrollment_id) => {
    try {
      const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = enrollEditForm;
      const enrollmentData = { season, reg_type, pre_test, post_test, refunded: refunded ? 1 : 0, refund_info };
      const { error } = await supabase.from('enrollments').update(enrollmentData).eq('enrollment_id', enrollment_id);
      if (error) throw error;
      
      const { data: oldCourses, error: fetchError } = await supabase.from('courses').select('*').eq('enrollment_id', enrollment_id);
      if (fetchError) throw fetchError;

      await supabase.from('courses').delete().eq('enrollment_id', enrollment_id);
      
      try {
        if (courses && courses.trim()) {
          const courseList = courses.split(/[,，]/).map(c => c.trim()).filter(c => c);
          if (courseList.length > 0) {
            const courseData = courseList.map(c => ({
              enrollment_id,
              course_name: c
            }));
            const { error: insertError } = await supabase.from('courses').insert(courseData);
            if (insertError) throw insertError;
          }
        }
      } catch (insertErr) {
        if (oldCourses && oldCourses.length > 0) {
          const restoreData = oldCourses.map(c => ({ enrollment_id: c.enrollment_id, course_name: c.course_name }));
          await supabase.from('courses').insert(restoreData);
        }
        throw new Error(`課程更新失敗，已還原原課程設定。(${insertErr.message})`);
      }

      alert('選課資料已更新');
      if (onRefresh) onRefresh();
      setEditingEnrollId(null);
    } catch (err) {
      alert('伺服器錯誤: ' + err.message);
    }
  }

  const handleDeleteEnrollment = async (enrollment_id) => {
    try {
      await supabase.from('courses').delete().eq('enrollment_id', enrollment_id);
      const { error } = await supabase.from('enrollments').delete().eq('enrollment_id', enrollment_id);
      if (error) throw error;
      alert('選課紀錄已刪除'); 
      if (onRefresh) onRefresh(); 
      setShowDeleteEnrollConfirm(null);
    } catch (err) {
      alert('伺服器錯誤: ' + err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose} id="modal-overlay">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-id-badge">{student.student_id}</span>
            <h2 className="modal-name">{student.name} ({student.gender || '未知'})</h2>
          </div>
          <div className="modal-header-actions">
            {!isEditing && (
              <>
                <button type="button" className="btn-edit" onClick={handleEditClick}>
                  <Edit2 size={14} /> 編輯
                </button>
                <button type="button" className="btn-delete" onClick={() => setShowDeleteConfirm(true)}>
                  <Trash2 size={14} /> 刪除
                </button>
              </>
            )}
            <button 
              type="button"
              className="btn-close" 
              onClick={onClose}
              id="btn-close-modal"
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        <div className="modal-body">
          {/* Basic info list */}
          <div>
            <h3 className="panel-title" style={{ marginBottom: '12px' }}>
              <User size={16} />
              基本聯絡資料
            </h3>
            
            {isEditing ? (
              <div className="form-grid" style={{ padding: '0', background: 'transparent' }}>
                <div className="form-group">
                  <label className="form-label">學員編號 (唯讀)</label>
                  <input type="text" className="form-input" value={editForm.student_id || ''} readOnly disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">姓名</label>
                  <input type="text" className="form-input" name="name" value={editForm.name || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">性別</label>
                  <select className="form-select" name="gender" value={editForm.gender || ''} onChange={handleFormChange}>
                    <option value="">請選擇</option>
                    <option value="男">男</option>
                    <option value="女">女</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">出生日期</label>
                  <input type="date" className="form-input" name="birth_date" value={editForm.birth_date || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">年齡 (自動)</label>
                  <input type="number" className="form-input" name="age" value={editForm.age || ''} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">是否達60歲 (自動)</label>
                  <input type="text" className="form-input" name="is_60_plus" value={editForm.is_60_plus || ''} readOnly />
                </div>
                <div className="form-group">
                  <label className="form-label">教育程度</label>
                  <input type="text" className="form-input" name="education" value={editForm.education || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">職業</label>
                  <input type="text" className="form-input" name="occupation" value={editForm.occupation || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">手機電話</label>
                  <input type="text" className="form-input" name="mobile_phone" value={editForm.mobile_phone || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">市話號碼</label>
                  <input type="text" className="form-input" name="home_phone" value={editForm.home_phone || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">通訊地址</label>
                  <input type="text" className="form-input" name="address" value={editForm.address || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">緊急聯絡人</label>
                  <input type="text" className="form-input" name="emergency_contact" value={editForm.emergency_contact || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group">
                  <label className="form-label">緊急聯絡人關係</label>
                  <input type="text" className="form-input" name="relationship" value={editForm.relationship || ''} onChange={handleFormChange} />
                </div>
                <div className="form-group full-width">
                  <label className="form-label">緊急聯絡人電話</label>
                  <input type="text" className="form-input" name="emergency_contact_phone" value={editForm.emergency_contact_phone || ''} onChange={handleFormChange} />
                </div>
                
                <div className="form-group full-width" style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>取消</button>
                  <button type="button" className="btn-primary" onClick={handleSaveStudent}>儲存變更</button>
                </div>
              </div>
            ) : (
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">出生日期 / 年齡</span>
                  <span className="detail-value">{student.birth_date || '未記錄'} {student.age ? `(${student.age} 歲)` : ''}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">是否達60歲</span>
                  <span className="detail-value">{student.is_60_plus || '未判定'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">教育程度</span>
                  <span className="detail-value">{student.education || '未記錄'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">職業</span>
                  <span className="detail-value">{student.occupation || '未記錄'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">手機電話</span>
                  <span className="detail-value">{student.mobile_phone || '未記錄'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">市話號碼</span>
                  <span className="detail-value">{student.home_phone || '未記錄'}</span>
                </div>
                <div className="detail-item" style={{ gridColumn: 'span 2' }}>
                  <span className="detail-label">通訊地址</span>
                  <span className="detail-value">{student.address || '未記錄'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">緊急聯絡人 (關係)</span>
                  <span className="detail-value">{student.emergency_contact || '未記錄'} {student.relationship ? `(${student.relationship})` : ''}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">緊急聯絡人電話</span>
                  <span className="detail-value">{student.emergency_contact_phone || '未記錄'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Study Timeline */}
          <div className="timeline-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 className="timeline-title" style={{ margin: 0 }}>
                <Activity size={16} />
                歷年參修歷程 ({studentTimeline.length} 期)
              </h3>
              <button 
                type="button"
                className="btn-primary"
                style={{ padding: '6px 12px', fontSize: '13px' }}
                onClick={onAddEnrollment}
                id="btn-add-enrollment-modal"
              >
                <span>+ 新增選課紀錄</span>
              </button>
            </div>
            {studentTimeline.length > 0 ? (
              <div className="timeline-container">
                {studentTimeline.map((item, idx) => (
                  <div 
                    className={`timeline-item ${idx === studentTimeline.length - 1 ? 'active' : ''} ${item.refunded ? 'refunded' : ''}`} 
                    key={idx}
                  >
                    <div className="timeline-dot"></div>
                    <div className="timeline-card">
                      <div className="timeline-meta">
                        <span className="timeline-season">{item.season}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {item.reg_type && (
                            <span className="timeline-reg-type">{item.reg_type === '新' ? '新生' : '續生'}</span>
                          )}
                          {item.refunded && (
                            <span className="badge danger" style={{ padding: '1px 6px', fontSize: '10px' }}>已退費</span>
                          )}
                        </div>
                        
                        <div className="timeline-actions">
                          <button type="button" className="timeline-action-btn" onClick={() => handleEditEnrollment(item)}>
                            <Edit2 size={14} />
                          </button>
                          <button type="button" className="timeline-action-btn danger" onClick={() => setShowDeleteEnrollConfirm(item.enrollment_id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {editingEnrollId === item.enrollment_id ? (
                        <div className="enrollment-edit-form">
                          <div className="form-group">
                            <label className="form-label">修課期別</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={enrollEditForm.season} 
                              onChange={e => setEnrollEditForm({...enrollEditForm, season: e.target.value})} 
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">新生/續生</label>
                            <select 
                              className="form-select" 
                              value={enrollEditForm.reg_type}
                              onChange={e => setEnrollEditForm({...enrollEditForm, reg_type: e.target.value})}
                            >
                              <option value="">請選擇</option>
                              <option value="新">新生</option>
                              <option value="續">續生</option>
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">前測分數</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={enrollEditForm.pre_test || ''} 
                              onChange={e => setEnrollEditForm({...enrollEditForm, pre_test: e.target.value})} 
                              placeholder="(分數)(年/月/日)"
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">後測分數</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={enrollEditForm.post_test || ''} 
                              onChange={e => setEnrollEditForm({...enrollEditForm, post_test: e.target.value})} 
                              placeholder="(分數)(年/月/日)"
                            />
                          </div>
                          <div className="form-group" style={{ gridColumn: 'span 2' }}>
                            <label className="form-label">修讀課程 (以逗號分隔)</label>
                            <input 
                              type="text" 
                              className="form-input" 
                              value={enrollEditForm.courses || ''} 
                              onChange={e => setEnrollEditForm({...enrollEditForm, courses: e.target.value})} 
                            />
                          </div>
                          <div className="form-group form-checkbox-group" style={{ gridColumn: 'span 2' }}>
                            <input 
                              type="checkbox" 
                              id={`edit-refunded-${item.enrollment_id}`} 
                              className="form-checkbox"
                              checked={enrollEditForm.refunded}
                              onChange={e => setEnrollEditForm({...enrollEditForm, refunded: e.target.checked})}
                            />
                            <label htmlFor={`edit-refunded-${item.enrollment_id}`} className="form-label" style={{ cursor: 'pointer' }}>
                              標記為已退費
                            </label>
                          </div>
                          {enrollEditForm.refunded && (
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                              <label className="form-label">退費備註 / 原因</label>
                              <input 
                                type="text" 
                                className="form-input" 
                                value={enrollEditForm.refund_info || ''} 
                                onChange={e => setEnrollEditForm({...enrollEditForm, refund_info: e.target.value})} 
                              />
                            </div>
                          )}
                          <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                            <button type="button" className="btn-secondary" onClick={() => setEditingEnrollId(null)}>取消</button>
                            <button type="button" className="btn-primary" onClick={() => handleSaveEnrollment(item.enrollment_id)}>儲存</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {(item.pre_test || item.post_test) && (
                            <div className="timeline-scores">
                              {item.pre_test && (
                                <div className="score-item">
                                  <span>前測:</span>
                                  <span className="score-val">{item.pre_test}</span>
                                </div>
                              )}
                              {item.post_test && (
                                <div className="score-item">
                                  <span>後測:</span>
                                  <span className="score-val">{item.post_test}</span>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="timeline-courses">
                            {item.courses && item.courses.length > 0 ? (
                              item.courses.map(c => (
                                <span className="course-tag" key={c}>{c}</span>
                              ))
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>無選課紀錄/僅進行測驗</span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>無修課歷程</p>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="刪除學員"
        message={`確定要刪除學員「${student.name}」（${student.student_id}）嗎？此操作無法復原，該學員的所有選課紀錄也會一併刪除。`}
        onConfirm={handleDeleteStudent}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        isOpen={showDeleteEnrollConfirm !== null}
        title="刪除選課紀錄"
        message={`確定要刪除此選課紀錄嗎？此操作無法復原。`}
        onConfirm={() => handleDeleteEnrollment(showDeleteEnrollConfirm)}
        onCancel={() => setShowDeleteEnrollConfirm(null)}
      />
    </div>
  )
}
