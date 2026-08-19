import { useState, useRef } from 'react'
import { GitMerge, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { mergeStudents } from '../../services/studentMergeService'
import useModalA11y from '../../hooks/useModalA11y'
import './studentMerge.css'

export default function StudentMergeDialog({ students = [], onClose, onRefresh }) {
  const modalRef = useRef(null)
  useModalA11y(modalRef, onClose)

  const [sourceSearch, setSourceSearch] = useState('')
  const [targetSearch, setTargetSearch] = useState('')
  const [sourceStudent, setSourceStudent] = useState(null)
  const [targetStudent, setTargetStudent] = useState(null)
  const [isMerging, setIsMerging] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const searchStudents = (query) => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return students.filter(s =>
      String(s.student_id).toLowerCase().includes(q) ||
      (s.name ?? '').toLowerCase().includes(q) ||
      (s.mobile_phone && s.mobile_phone.includes(q))
    ).slice(0, 5)
  }

  const handleMerge = async () => {
    if (!sourceStudent || !targetStudent) return
    setIsMerging(true)
    setError('')
    try {
      const data = await mergeStudents(supabase, sourceStudent.student_id, targetStudent.student_id)
      setResult(data)
      onRefresh?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <div className="modal-overlay-center" role="dialog" aria-modal="true" aria-label="學員合併">
      <div className="student-merge-dialog" ref={modalRef}>
        <h2><GitMerge size={20} /> 學員資料合併</h2>
        <p className="merge-description">
          將「來源學員」的所有修課紀錄轉移至「目標學員」，完成後將刪除來源學員。
        </p>

        {result ? (
          <div className="merge-result">
            <p className="merge-success">✅ 合併完成</p>
            <p>已轉移 {result.moved_enrollments} 筆報名紀錄至學員 #{result.target_id}</p>
            <p>來源學員 #{result.source_id} 已成功刪除</p>
            <button type="button" className="btn-primary" onClick={onClose}>關閉視窗</button>
          </div>
        ) : (
          <>
            <div className="merge-pickers">
              <div className="merge-picker">
                <label>來源學員（將被轉移並刪除）</label>
                <input
                  type="text"
                  placeholder="搜尋編號、姓名或電話..."
                  value={sourceSearch}
                  onChange={e => { setSourceSearch(e.target.value); setSourceStudent(null) }}
                />
                {sourceSearch && !sourceStudent && (
                  <div className="merge-search-list">
                    {searchStudents(sourceSearch).map(s => (
                      <div
                        key={s.student_id}
                        className="merge-pick-item"
                        onClick={() => { setSourceStudent(s); setSourceSearch(`${s.name} (#${s.student_id})`) }}
                      >
                        #{s.student_id} {s.name} {s.mobile_phone ? `(${s.mobile_phone})` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {sourceStudent && (
                  <div className="merge-selected">
                    #{sourceStudent.student_id} {sourceStudent.name}
                  </div>
                )}
              </div>

              <ArrowRight size={24} className="merge-arrow" />

              <div className="merge-picker">
                <label>目標學員（保留資料）</label>
                <input
                  type="text"
                  placeholder="搜尋編號、姓名或電話..."
                  value={targetSearch}
                  onChange={e => { setTargetSearch(e.target.value); setTargetStudent(null) }}
                />
                {targetSearch && !targetStudent && (
                  <div className="merge-search-list">
                    {searchStudents(targetSearch).map(s => (
                      <div
                        key={s.student_id}
                        className="merge-pick-item"
                        onClick={() => { setTargetStudent(s); setTargetSearch(`${s.name} (#${s.student_id})`) }}
                      >
                        #{s.student_id} {s.name} {s.mobile_phone ? `(${s.mobile_phone})` : ''}
                      </div>
                    ))}
                  </div>
                )}
                {targetStudent && (
                  <div className="merge-selected">
                    #{targetStudent.student_id} {targetStudent.name}
                  </div>
                )}
              </div>
            </div>

            {error && <p className="merge-error">{error}</p>}

            <div className="merge-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={isMerging}>取消</button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleMerge}
                disabled={!sourceStudent || !targetStudent || isMerging}
                style={{ backgroundColor: 'var(--color-danger, #ef4444)', borderColor: 'var(--color-danger, #ef4444)' }}
              >
                {isMerging ? '合併處理中...' : '確認合併'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
