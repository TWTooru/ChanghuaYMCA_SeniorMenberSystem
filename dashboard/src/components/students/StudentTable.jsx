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
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const pageSizeOptions = [10, 20, 50, 100].map(size => ({
  label: `${size} 筆/頁`,
  value: String(size),
}))

export default function StudentTable({
  students,
  _enrollments,
  sortField,
  sortOrder,
  onSort,
  onSelectStudent,
  studentPage,
  totalStudentPages,
  onPageChange,
  totalFilteredCount,
  itemsPerPage,
  onPageSizeChange
}) {
  /** 表格只呈現目前頁面的學員；列點擊與修課紀錄操作由父層處理選取狀態。 */
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

  const renderSortIcon = (field) => {
    if (sortField !== field) return <ArrowUpDown size={14} />
    if (sortOrder === 'asc') return <ArrowUp size={14} />
    return <ArrowDown size={14} />
  }

  const getAriaSort = (field) => sortField === field ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'

  return (
    <div className="table-wrapper student-table">
      <div className="table-scroll">
        <Table className="data-table">
          <TableHeader>
            <TableRow>
              <TableHead aria-sort={getAriaSort('student_id')}>
                <button type="button" className="table-sort-button" onClick={() => onSort('student_id')}>
                  學員ID
                  {renderSortIcon('student_id')}
                </button>
              </TableHead>
              <TableHead aria-sort={getAriaSort('name')}>
                <button type="button" className="table-sort-button" onClick={() => onSort('name')}>
                  姓名
                  {renderSortIcon('name')}
                </button>
              </TableHead>
              <TableHead>性別</TableHead>
              <TableHead>目前年齡</TableHead>
              <TableHead>出生日期</TableHead>
              <TableHead>手機電話</TableHead>
              <TableHead>緊急聯絡人</TableHead>
              <TableHead>關係</TableHead>
              <TableHead>教育程度</TableHead>
              <TableHead>現況操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students && students.length > 0 ? (
              students.map(s => (
                <TableRow 
                  key={s.student_id} 
                  className="clickable"
                  onClick={() => onSelectStudent(s, 'profile')}
                  id={`row-student-${s.student_id}`}
                >
                  <TableCell className="table-cell-bold">{s.student_id}</TableCell>
                  <TableCell className="table-cell-bold">{s.name}</TableCell>
                  <TableCell>
                    <span className={`badge ${s.gender === '男' ? 'neutral' : 'accent'}`}>
                      {s.gender || '未知'}
                    </span>
                  </TableCell>
                  <TableCell>{s.age ? `${s.age} 歲` : '未知'}</TableCell>
                  <TableCell>{s.birth_date || '--'}</TableCell>
                  <TableCell>{s.mobile_phone || '--'}</TableCell>
                  <TableCell>{s.emergency_contact || '--'}</TableCell>
                  <TableCell>{s.relationship || '--'}</TableCell>
                  <TableCell>{s.education || '--'}</TableCell>
                  <TableCell>
                    <Button 
                      type="button"
                      variant="secondary"
                      className="btn-secondary" 
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelectStudent(s, 'history')
                      }}
                    >
                      查看歷程
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  未找到符合條件的學員資料。
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* 目前篩選結果的分頁控制項。 */}
      <div className="table-footer">
        <div className="footer-info">
          顯示第 {totalFilteredCount > 0 ? (studentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(studentPage * itemsPerPage, totalFilteredCount)} 筆學員（共 {totalFilteredCount} 筆）
        </div>
        <div className="page-size-selector">
          <label htmlFor="student-page-size">每頁筆數</label>
          <Select
            items={pageSizeOptions}
            value={String(itemsPerPage)}
            onValueChange={value => onPageSizeChange(Number(value))}
          >
            <SelectTrigger id="student-page-size" aria-label="每頁筆數" size="sm" className="page-size-trigger">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {pageSizeOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="pagination-buttons">
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="btn-secondary"
            onClick={() => onPageChange(1)}
            disabled={studentPage === 1}
            id="btn-student-first"
            aria-label="跳至最前頁"
            title="跳至最前頁"
          >
            <ChevronsLeft size={16} style={{ display: 'block' }} />
          </Button>
          <Button 
            type="button"
            variant="outline"
            size="icon-sm"
            className="btn-secondary"
            onClick={() => onPageChange(Math.max(studentPage - 1, 1))}
            disabled={studentPage === 1}
            id="btn-student-prev"
            aria-label="上一頁"
          >
            <ChevronLeft size={16} style={{ display: 'block' }} />
          </Button>

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
              <Button
                key={`page-${page}`}
                type="button"
                variant={isActive ? 'default' : 'outline'}
                size="icon-sm"
                className={`btn-secondary ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange(page)}
                aria-label={`第 ${page} 頁`}
                aria-current={isActive ? 'page' : undefined}
                style={isActive ? { 
                  backgroundColor: 'var(--color-accent)', 
                  borderColor: 'var(--color-accent)', 
                  color: '#fff',
                  boxShadow: '0 0 10px rgba(99, 102, 241, 0.4)' 
                } : undefined}
              >
                {page}
              </Button>
            )
          })}

          <Button 
            type="button"
            variant="outline"
            size="icon-sm"
            className="btn-secondary"
            onClick={() => onPageChange(Math.min(studentPage + 1, totalStudentPages))}
            disabled={studentPage === totalStudentPages}
            id="btn-student-next"
            aria-label="下一頁"
          >
            <ChevronRight size={16} style={{ display: 'block' }} />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="btn-secondary"
            onClick={() => onPageChange(totalStudentPages)}
            disabled={studentPage === totalStudentPages}
            id="btn-student-last"
            aria-label="跳至最尾頁"
            title="跳至最尾頁"
          >
            <ChevronsRight size={16} style={{ display: 'block' }} />
          </Button>
        </div>
      </div>
    </div>
  )
}
