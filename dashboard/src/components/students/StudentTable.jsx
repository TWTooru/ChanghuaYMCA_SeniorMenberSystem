import { useMemo } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'
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

const columns = [
  { label: 'ID', field: 'student_id' },
  { label: '姓名', field: 'name' },
  { label: '性別' },
  { label: '電子郵件' },
  { label: '電話' },
  { label: '出生年月日' },
  { label: '通訊處' },
  { label: '服務機關 / 學校' },
  { label: '教育程度' },
]
const pageSizeOptions = [10, 20, 50, 100].map(size => ({
  label: `${size} 筆/頁`,
  value: String(size),
}))

export default function StudentTable({ students, sortField, sortOrder, onSort, onSelectStudent, studentPage, totalStudentPages, onPageChange, totalFilteredCount, itemsPerPage, onPageSizeChange }) {
  const pageNumbers = useMemo(() => Array.from({ length: totalStudentPages }, (_, index) => index + 1).slice(Math.max(0, studentPage - 2), studentPage + 1), [studentPage, totalStudentPages])

  return <div className="table-wrapper student-table">
    <Table className="data-table">
      <TableHeader>
        <TableRow>
          {columns.map(column => {
            const sortable = Boolean(column.field)
            const isActiveSort = sortField === column.field

            return <TableHead
              key={column.label}
              aria-sort={sortable ? (isActiveSort ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
            >
              {sortable ? <Button
                type="button"
                variant="ghost"
                size="sm"
                className="student-sort-button"
                aria-label={`依${column.label === 'ID' ? ' ID ' : column.label}排序`}
                onClick={() => onSort(column.field)}
              >
                {column.label}
                {isActiveSort && (sortOrder === 'asc' ? <ArrowUp /> : <ArrowDown />)}
              </Button> : column.label}
            </TableHead>
          })}
          <TableHead>操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {students?.length ? students.map(student => <TableRow
          key={student.student_id}
          className="clickable"
          id={`row-student-${student.student_id}`}
          onClick={() => onSelectStudent(student, 'profile')}
        >
          <TableCell className="table-cell-bold">{student.student_id}</TableCell>
          <TableCell className="table-cell-bold">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="student-profile-button"
              aria-label={`查看${student.name}會員資料`}
              onClick={event => {
                event.stopPropagation()
                onSelectStudent(student, 'profile')
              }}
            >{student.name}</Button>
          </TableCell>
          <TableCell>{student.gender}</TableCell>
          <TableCell>{student.email || '--'}</TableCell>
          <TableCell>{student.phone || '--'}</TableCell>
          <TableCell>{student.birth_date || '--'}</TableCell>
          <TableCell>{student.address || '--'}</TableCell>
          <TableCell>{student.organization || '--'}</TableCell>
          <TableCell>{student.education}</TableCell>
          <TableCell><Button type="button" variant="outline" size="sm" onClick={event => { event.stopPropagation(); onSelectStudent(student, 'history') }}>查看歷程</Button></TableCell>
        </TableRow>) : <TableRow><TableCell colSpan={10} className="student-table-empty">未找到符合條件的會員。</TableCell></TableRow>}
      </TableBody>
    </Table>
    <div className="table-footer"><div className="footer-info">
      <span>顯示第 {totalFilteredCount ? (studentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(studentPage * itemsPerPage, totalFilteredCount)} 筆會員（共 {totalFilteredCount} 筆）</span>
      <Select items={pageSizeOptions} value={String(itemsPerPage)} onValueChange={value => onPageSizeChange(Number(value))}>
        <SelectTrigger aria-label="每頁筆數" size="sm" className="page-size-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {pageSizeOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div><div className="pagination-buttons">
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={studentPage === 1} aria-label="跳至最前頁"><ChevronsLeft /></Button>
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onPageChange(Math.max(1, studentPage - 1))} disabled={studentPage === 1} aria-label="上一頁"><ChevronLeft /></Button>
      {pageNumbers.map(page => <Button
        key={page}
        type="button"
        variant={page === studentPage ? 'default' : 'outline'}
        size="icon-sm"
        aria-label={`第 ${page} 頁`}
        aria-current={page === studentPage ? 'page' : undefined}
        onClick={() => onPageChange(page)}
      >{page}</Button>)}
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onPageChange(Math.min(totalStudentPages, studentPage + 1))} disabled={studentPage === totalStudentPages} aria-label="下一頁"><ChevronRight /></Button>
      <Button type="button" variant="outline" size="icon-sm" onClick={() => onPageChange(totalStudentPages)} disabled={studentPage === totalStudentPages} aria-label="跳至最尾頁"><ChevronsRight /></Button>
    </div></div>
  </div>
}
