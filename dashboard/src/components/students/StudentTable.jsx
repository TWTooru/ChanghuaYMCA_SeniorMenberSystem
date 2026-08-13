import { useMemo } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

export default function StudentTable({ students, sortOrder, onToggleSort, onSelectStudent, studentPage, totalStudentPages, onPageChange, totalFilteredCount }) {
  const itemsPerPage = 10
  const pageNumbers = useMemo(() => Array.from({ length: totalStudentPages }, (_, index) => index + 1).slice(Math.max(0, studentPage - 2), studentPage + 1), [studentPage, totalStudentPages])
  const columns = ['ID', '姓名', '性別', '電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校', '教育程度']

  return <div className="table-wrapper"><div className="table-scroll"><table className="data-table"><thead><tr>
    {columns.map((column, index) => <th key={column} className={index === 0 ? 'clickable' : undefined} onClick={index === 0 ? onToggleSort : undefined}>{index === 0 ? <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>ID {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</span> : column}</th>)}
    <th>操作</th>
  </tr></thead><tbody>{students?.length ? students.map(student => <tr key={student.student_id} className="clickable" id={`row-student-${student.student_id}`} onClick={() => onSelectStudent(student, 'profile')}>
    <td className="table-cell-bold">{student.student_id}</td><td className="table-cell-bold">{student.name}</td><td>{student.gender}</td><td>{student.email || '--'}</td><td>{student.phone || '--'}</td><td>{student.birth_date || '--'}</td><td>{student.address || '--'}</td><td>{student.organization || '--'}</td><td>{student.education}</td>
    <td><button type="button" className="btn-secondary" onClick={event => { event.stopPropagation(); onSelectStudent(student, 'history') }}>查看歷程</button></td>
  </tr>) : <tr><td colSpan={10} style={{ textAlign: 'center', padding: '32px' }}>未找到符合條件的會員。</td></tr>}</tbody></table></div>
  <div className="table-footer"><div className="footer-info">顯示第 {totalFilteredCount ? (studentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(studentPage * itemsPerPage, totalFilteredCount)} 筆會員（共 {totalFilteredCount} 筆）</div><div className="pagination-buttons">
    <button type="button" className="btn-secondary" onClick={() => onPageChange(1)} disabled={studentPage === 1} aria-label="跳至最前頁"><ChevronsLeft size={16} /></button><button type="button" className="btn-secondary" onClick={() => onPageChange(Math.max(1, studentPage - 1))} disabled={studentPage === 1}><ChevronLeft size={16} /></button>
    {pageNumbers.map(page => <button key={page} type="button" className={`btn-secondary ${page === studentPage ? 'active' : ''}`} onClick={() => onPageChange(page)}>{page}</button>)}
    <button type="button" className="btn-secondary" onClick={() => onPageChange(Math.min(totalStudentPages, studentPage + 1))} disabled={studentPage === totalStudentPages}><ChevronRight size={16} /></button><button type="button" className="btn-secondary" onClick={() => onPageChange(totalStudentPages)} disabled={studentPage === totalStudentPages} aria-label="跳至最尾頁"><ChevronsRight size={16} /></button>
  </div></div></div>
}
