import { useState, useMemo } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
import { getStudentById } from '../../domain/studentRelations'
import { summarizeEnrollmentBilling } from '../../domain/enrollmentBilling'
import { comparePeriods } from '../../domain/period'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import './enrollment.css'

export default function EnrollmentTab({ students, enrollments, onSelectEnrollment }) {
  const [historySearch, setHistorySearch] = useState('')
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState('')
  const [historyRefundFilter, setHistoryRefundFilter] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const itemsPerPage = 10

  // 篩選、排序與分頁皆由同一份 `enrollments` 推導，避免各區塊使用不同條件而顯示不一致的報名歷程。
  const periodsList = useMemo(() => {
    if (!enrollments) return []
    const set = new Set(enrollments.map(e => e.period))
    return Array.from(set).sort(comparePeriods)
  }, [enrollments])

  const filteredHistory = useMemo(() => {
    if (!enrollments) return []
    return enrollments.filter(e => {
      const normalizedSearch = historySearch.toLowerCase()
      const matchesSearch =
        (e.student_name || '').toLowerCase().includes(normalizedSearch) ||
        (e.courses || []).some(c => c.toLowerCase().includes(normalizedSearch))
      
      const matchesPeriod = historyPeriodFilter === '' || e.period === historyPeriodFilter
      
      let matchesRefund = true
      if (historyRefundFilter !== '') {
        if (historyRefundFilter === 'refunded') matchesRefund = e.refundStatus === 'refunded' || e.refunded === true
        else if (historyRefundFilter === 'partial') matchesRefund = e.refundStatus === 'partial'
        else if (historyRefundFilter === 'normal') matchesRefund = e.refundStatus === 'normal' || (!e.refunded && e.refundStatus !== 'partial')
      }
      
      return matchesSearch && matchesPeriod && matchesRefund
    })
  }, [enrollments, historySearch, historyPeriodFilter, historyRefundFilter])

  const paginatedHistory = useMemo(() => {
    const startIndex = (historyPage - 1) * itemsPerPage
    return filteredHistory.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredHistory, historyPage])

  const totalHistoryPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1

  return (
    <div>
      {/* Filters panel */}
      <div className="filters-panel">
        <div className="filter-group">
          <Label className="filter-label" htmlFor="history-search">搜尋姓名或課程</Label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <Input
              id="history-search" 
              className="h-10 search-input"
              placeholder="輸入姓名或課程名稱搜尋..."
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value)
                setHistoryPage(1)
              }}
            />
          </div>
        </div>
        <div className="filter-group">
          <Label className="filter-label" htmlFor="history-period">篩選期別</Label>
          <Select
            items={[{ value: 'all', label: '全部期別' }, ...periodsList.map(period => ({ value: period, label: period }))]}
            value={historyPeriodFilter || 'all'}
            onValueChange={(value) => {
              setHistoryPeriodFilter(value === 'all' ? '' : value)
              setHistoryPage(1)
            }}
          >
            <SelectTrigger id="history-period" className="h-10 select-input" aria-label="篩選期別"><SelectValue placeholder="全部期別" /></SelectTrigger>
            <SelectContent>
            <SelectItem value="all">全部期別</SelectItem>
            {periodsList.map((period, index) => (
              <SelectItem key={`period-${period}-${index}`} value={period}>{period}</SelectItem>
            ))}
            </SelectContent>
          </Select>
        </div>
        <div className="filter-group">
          <Label className="filter-label" htmlFor="history-refund">退費狀況</Label>
          <Select
            items={[
              { value: 'all', label: '全部狀態' },
              { value: 'normal', label: '正常 (無退費)' },
              { value: 'partial', label: '部分退費' },
              { value: 'refunded', label: '已退費' },
            ]}
            value={historyRefundFilter || 'all'}
            onValueChange={(value) => {
              setHistoryRefundFilter(value === 'all' ? '' : value)
              setHistoryPage(1)
            }}
          >
            <SelectTrigger id="history-refund" className="h-10 select-input" aria-label="退費狀況"><SelectValue placeholder="全部狀態" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="normal">正常 (無退費)</SelectItem>
              <SelectItem value="partial">部分退費</SelectItem>
              <SelectItem value="refunded">已退費</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* History Table */}
      <div className="table-wrapper">
        <div className="table-scroll">
          <Table className="data-table" aria-label="歷年選課歷程">
            <TableHeader>
              <TableRow>
                <TableHead>姓名</TableHead>
                <TableHead>期別</TableHead>
                <TableHead>課程</TableHead>
                <TableHead>退費狀況</TableHead>
                <TableHead>金額</TableHead>
                <TableHead>發票編號</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((e, idx) => {
                  const billing = summarizeEnrollmentBilling(e)
                  const isRefunded = e.refundStatus === 'refunded' || e.refunded === true
                  const isPartial = e.refundStatus === 'partial'

                  return (
                  <TableRow
                    key={`${e.student_id}-${e.period}-${idx}`}
                    className="clickable"
                    onClick={() => {
                      const student = getStudentById(students, e.student_id)
                      if (student && onSelectEnrollment) onSelectEnrollment(student, e)
                    }}
                  >
                    <TableCell className="table-cell-bold">
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-inherit"
                        aria-label={`查看${e.student_name}的選課明細`}
                        onClick={event => {
                          event.stopPropagation()
                          const student = getStudentById(students, e.student_id)
                          if (student && onSelectEnrollment) onSelectEnrollment(student, e)
                        }}
                      >
                        {e.student_name}
                      </Button>
                    </TableCell>
                    <TableCell>{e.period}</TableCell>
                    <TableCell>
                      <div className="timeline-courses">
                        {(e.courses || []).map(c => (
                          <span className="course-tag" key={c}>{c}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isRefunded ? 'destructive' : isPartial ? 'secondary' : 'default'} className={`badge ${isRefunded ? 'danger' : isPartial ? 'warning' : 'success'}`}>
                        {isRefunded ? '已退費' : isPartial ? '部分退費' : '正常'}
                      </Badge>
                    </TableCell>
                    <TableCell>{billing.amount == null ? '--' : `NT$ ${billing.amount}`}</TableCell>
                    <TableCell>
                      {billing.invoiceNumbers.length > 0 ? (
                        <div className="invoice-number-list">
                          {billing.invoiceNumbers.map((invoice, i) => (
                            <span key={`${invoice}-${i}`} className="invoice-number-tag">{invoice}</span>
                          ))}
                        </div>
                      ) : '--'}
                    </TableCell>
                  </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                    未找到選課歷程。
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="table-footer">
          <div className="footer-info">
            顯示第 {filteredHistory.length > 0 ? (historyPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(historyPage * itemsPerPage, filteredHistory.length)} 筆紀錄（共 {filteredHistory.length} 筆）
          </div>
          <nav className="pagination-buttons" aria-label="歷年選課歷程分頁">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setHistoryPage(1)}
              disabled={historyPage === 1}
              id="btn-history-first"
              aria-label="跳至最前頁"
              title="跳至最前頁"
            >
              <ChevronsLeft size={16} style={{ display: 'block' }} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setHistoryPage(p => Math.max(p - 1, 1))}
              disabled={historyPage === 1}
              id="btn-history-prev"
              aria-label="上一頁"
            >
              <ChevronLeft size={16} style={{ display: 'block' }} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setHistoryPage(p => Math.min(p + 1, totalHistoryPages))}
              disabled={historyPage === totalHistoryPages}
              id="btn-history-next"
              aria-label="下一頁"
            >
              <ChevronRight size={16} style={{ display: 'block' }} />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setHistoryPage(totalHistoryPages)}
              disabled={historyPage === totalHistoryPages}
              id="btn-history-last"
              aria-label="跳至最尾頁"
              title="跳至最尾頁"
            >
              <ChevronsRight size={16} style={{ display: 'block' }} />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  )
}
