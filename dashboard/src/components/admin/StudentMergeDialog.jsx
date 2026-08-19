import React, { useState, useMemo } from 'react';
import useModalA11y from '../../hooks/useModalA11y';
import { mergeStudents } from '../../services/studentMergeService';
import { supabase } from '../../lib/supabaseClient';
import './studentMerge.css';

export default function StudentMergeDialog({ students = [], onClose, onRefresh }) {
  const modalRef = useModalA11y(true, onClose);
  
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  
  const [sourceStudent, setSourceStudent] = useState(null);
  const [targetStudent, setTargetStudent] = useState(null);
  
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const filteredSource = useMemo(() => {
    if (!sourceSearch) return students;
    return students.filter(s => 
      s.id.toString().includes(sourceSearch) || 
      (s.name && s.name.includes(sourceSearch))
    );
  }, [students, sourceSearch]);

  const filteredTarget = useMemo(() => {
    if (!targetSearch) return students;
    return students.filter(s => 
      s.id.toString().includes(targetSearch) || 
      (s.name && s.name.includes(targetSearch))
    );
  }, [students, targetSearch]);

  const handleMerge = async () => {
    if (!sourceStudent || !targetStudent) return;
    
    setIsMerging(true);
    setError(null);
    try {
      const res = await mergeStudents(supabase, sourceStudent.id, targetStudent.id);
      setResult(res);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <div className="merge-dialog-overlay">
      <div className="merge-dialog" ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="merge-dialog-title">
        {result ? (
          <div className="merge-result-view">
            <h3>合併成功</h3>
            <p>已將來源學員的報名紀錄轉移至目標學員。</p>
            <p>轉移紀錄數：{result.moved_enrollments}</p>
            <button className="merge-btn secondary" onClick={onClose}>關閉</button>
          </div>
        ) : (
          <>
            <div className="merge-dialog-header" id="merge-dialog-title">
              <span role="img" aria-label="merge">🔀</span> 學員資料合併
            </div>
            <div className="merge-dialog-desc">
              注意：來源學員的所有報名紀錄將被轉移至目標學員，且來源學員將被刪除。此動作無法復原。
            </div>

            {error && <div className="merge-error-banner">{error}</div>}

            <div className="merge-panels">
              {/* Source Panel */}
              <div className="merge-panel">
                <div className="merge-panel-title">來源學員（將被刪除）</div>
                <input 
                  type="text" 
                  className="merge-search-input"
                  placeholder="搜尋 ID 或姓名" 
                  value={sourceSearch}
                  onChange={e => setSourceSearch(e.target.value)}
                />
                <div className="merge-student-list">
                  {filteredSource.map(s => (
                    <div 
                      key={s.id} 
                      className={`merge-student-item ${sourceStudent?.id === s.id ? 'selected' : ''}`}
                      onClick={() => setSourceStudent(s)}
                    >
                      {s.id} - {s.name}
                    </div>
                  ))}
                </div>
                {sourceStudent && (
                  <div className="merge-tag">已選擇：{sourceStudent.name} (ID: {sourceStudent.id})</div>
                )}
              </div>

              {/* Target Panel */}
              <div className="merge-panel">
                <div className="merge-panel-title">目標學員（保留）</div>
                <input 
                  type="text" 
                  className="merge-search-input"
                  placeholder="搜尋 ID 或姓名" 
                  value={targetSearch}
                  onChange={e => setTargetSearch(e.target.value)}
                />
                <div className="merge-student-list">
                  {filteredTarget.map(s => (
                    <div 
                      key={s.id} 
                      className={`merge-student-item ${targetStudent?.id === s.id ? 'selected' : ''}`}
                      onClick={() => setTargetStudent(s)}
                    >
                      {s.id} - {s.name}
                    </div>
                  ))}
                </div>
                {targetStudent && (
                  <div className="merge-tag">已選擇：{targetStudent.name} (ID: {targetStudent.id})</div>
                )}
              </div>
            </div>

            <div className="merge-actions">
              <button className="merge-btn secondary" onClick={onClose} disabled={isMerging}>取消</button>
              <button 
                className="merge-btn danger" 
                onClick={handleMerge} 
                disabled={!sourceStudent || !targetStudent || isMerging}
              >
                {isMerging ? '合併中...' : '確認合併'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
