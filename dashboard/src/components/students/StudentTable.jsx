import { useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'

export default function StudentTable({
  students,
  _enrollments,
  sortOrder,
  onToggleSort,
  onSelectStudent,
  studentPage,
  totalStudentPages,
  onPageChange,
  totalFilteredCount
}) {
  const itemsPerPage = 10

  const pageNumbers = useMemo(() => {
    const range = []
    let start = Math.max(1, studentPage - 1)
    let end = Math.min(totalStudentPages, studentPage + 1)
    
    if (studentPage === 1) {
      end = Math.min(totalStudentPages, 3)
    } else if (studentPage === totalStudentPages) {
      start = Math.max(1, totalStudentPages - 2)
    }
    
    for (let i = start; i <= end; i++) {
      range.push(i)
    }
    return range
  }, [studentPage, totalStudentPages])

  const renderSortIcon = () => {
    if (sortOrder === 'asc') return <ArrowUp size={14} />
    if (sortOrder === 'desc') return <ArrowDown size={14} />
    return <ArrowUpDown size={14} />
  }

  return (
    <div className="table-wrapper">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th 
                className="clickable" 
                onClick={onToggleSort}
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  學員ID
                  {renderSortIcon()}
                </div>
              </th>
              <th>姓名</th>
              <th>性別</th>
              <th>目前年齡</th>
              <th>出生日期</th>
              <th>手機電話</th>
              <th>緊急聯絡人</th>
              <th>關係</th>
              <th>教育程度</th>
              <th>現況操作</th>
            </tr>
          </thead>
          <tbody>
            {students && students.length > 0 ? (
              students.map(s => (
                <tr 
                  key={s.student_id} 
                  className="clickable"
                  onClick={() => onSelectStudent(s, 'profile')}
                  id={`row-student-${s.student_id}`}
                >
                  <td className="table-cell-bold">{s.student_id}</td>
                  <td className="table-cell-bold">{s.name}</td>
                  <td>
                    <span className={`badge ${s.gender === '男' ? 'neutral' : 'accent'}`}>
                      {s.gender || '未知'}
                    </span>
                  </td>
                  <td>{s.age ? `${s.age} 歲` : '未知'}</td>
                  <td>{s.birth_date || '--'}</td>
                  <td>{s.mobile_phone || '--'}</td>
                  <td>{s.emergency_contact || '--'}</td>
                  <td>{s.relationship || '--'}</td>
                  <td>{s.education || '--'}</td>
                  <td>
                    <button 
                      type="button"
                      className="btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectStudent(s, 'history')
                      }}
                    >
                      查看歷程
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  未找到符合條件的學員資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Table Pagination */}
      <div className="table-footer">
        <div className="footer-info">
          顯示第 {totalFilteredCount > 0 ? (studentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(studentPage * itemsPerPage, totalFilteredCount)} 筆學員（共 {totalFilteredCount} 筆）
        </div>
        <div className="pagination-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(1)}
            disabled={studentPage === 1}
            id="btn-student-first"
            aria-label="跳至最前頁"
            title="跳至最前頁"
          >
            <ChevronsLeft size={16} style={{ display: 'block' }} />
          </button>
          <button 
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(Math.max(studentPage - 1, 1))}
            disabled={studentPage === 1}
            id="btn-student-prev"
          >
            <ChevronLeft size={16} style={{ display: 'block' }} />
          </button>

          {pageNumbers.map((page, index) => {
            if (page === '...') {
              return (
                <span 
                  key={`ellipsis-${index}`} 
                  style={{ 
                    display: 'inline-flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    padding: '0 8px', 
                    color: 'var(--text-muted)',
                    userSelect: 'none' 
                  }}
                >
                  ...
                </span>
              )
            }
            const isActive = page === studentPage
            return (
              <button
                key={`page-${page}`}
                type="button"
                className={`btn-secondary ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                style={isActive ? { 
                  backgroundColor: 'var(--color-accent)', 
                  borderColor: 'var(--color-accent)', 
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)' 
                } : undefined}
              >
                {page}
              </button>
            )
          })}

          <button 
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(Math.min(studentPage + 1, totalStudentPages))}
            disabled={studentPage === totalStudentPages}
            id="btn-student-next"
          >
            <ChevronRight size={16} style={{ display: 'block' }} />
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(totalStudentPages)}
            disabled={studentPage === totalStudentPages}
            id="btn-student-last"
            aria-label="跳至最尾頁"
            title="跳至最尾頁"
          >
            <ChevronsRight size={16} style={{ display: 'block' }} />
          </button>
        </div>
      </div>
    </div>
  )
}
