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
import { compareSeasons } from '../../domain/season'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import './enrollment.css'

export default function EnrollmentTab({ students, enrollments, onSelectEnrollment }) {
  const [historySearch, setHistorySearch] = useState('')
  const [historySeasonFilter, setHistorySeasonFilter] = useState('')
  const [historyRefundFilter, setHistoryRefundFilter] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const itemsPerPage = 10

  // 篩選、排序與分頁皆由同一份 `enrollments` 推導，避免各區塊使用不同條件而顯示不一致的報名歷程。
  const seasonsList = useMemo(() => {
    if (!enrollments) return []
    const set = new Set(enrollments.map(e => e.season).filter(Boolean))
    return Array.from(set).sort(compareSeasons)
  }, [enrollments])

  const filteredHistory = useMemo(() => {
    if (!enrollments) return []
    return enrollments.filter(e => {
      const normalizedSearch = historySearch.toLowerCase()
      const billing = summarizeEnrollmentBilling(e)
      const matchesSearch =
        String(e.student_name ?? '').toLowerCase().includes(normalizedSearch) ||
        (e.courses ?? []).some(c => String(c).toLowerCase().includes(normalizedSearch)) ||
        billing.invoiceNumbers.some(number => String(number).toLowerCase().includes(normalizedSearch))
      
      const matchesSeason = historySeasonFilter === '' || e.season === historySeasonFilter
      
      let matchesRefund = true
      if (historyRefundFilter !== '') {
        if (historyRefundFilter === 'refunded') matchesRefund = e.refunded === true || e.refundStatus === 'refunded'
        else if (historyRefundFilter === 'normal') matchesRefund = !e.refunded || e.refundStatus === 'normal'
      }
      
      return matchesSearch && matchesSeason && matchesRefund
    })
  }, [enrollments, historySearch, historySeasonFilter, historyRefundFilter])

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
          <Label className="filter-label" htmlFor="history-search">搜尋姓名、課程或收據 No.</Label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <Input
              type="text"
              id="history-search" 
              className="search-input"
              placeholder="輸入姓名、課程或收據 No. 搜尋..."
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value)
                setHistoryPage(1)
              }}
            />
          </div>
        </div>
        <div className="filter-group">
          <Label className="filter-label" htmlFor="history-season">篩選季別</Label>
          <Select
            value={historySeasonFilter || 'all'}
            onValueChange={(value) => {
              setHistorySeasonFilter(value === 'all' ? '' : value)
              setHistoryPage(1)
            }}
          >
            <SelectTrigger id="history-season" className="w-full" aria-label="篩選季別">
              <SelectValue placeholder="全部期別" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部期別</SelectItem>
              {seasonsList.map((s, index) => (
                <SelectItem key={`season-${s}-${index}`} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="filter-group">
          <Label className="filter-label" htmlFor="history-refund">退費狀況</Label>
          <Select
            value={historyRefundFilter || 'all'}
            onValueChange={(value) => {
              setHistoryRefundFilter(value === 'all' ? '' : value)
              setHistoryPage(1)
            }}
          >
            <SelectTrigger id="history-refund" className="w-full" aria-label="退費狀況">
              <SelectValue placeholder="全部狀態" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部狀態</SelectItem>
              <SelectItem value="normal">正常 (無退費)</SelectItem>
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
                <TableHead>季別</TableHead>
                <TableHead>課程</TableHead>
                <TableHead>收費狀況</TableHead>
                <TableHead>金額</TableHead>
                <TableHead>收據 No.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((e, idx) => {
                  const billing = summarizeEnrollmentBilling(e)

                  return (
                    <TableRow 
                      key={`${e.student_id}-${e.season}-${idx}`}
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
                          className="h-auto p-0 text-inherit font-bold hover:no-underline"
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
                      <TableCell>{e.season}</TableCell>
                      <TableCell>
                        <div className="timeline-courses">
                          {(e.courses || []).map(c => (
                            <span className="course-tag" key={c}>{c}</span>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={e.refunded ? 'destructive' : 'default'}
                          className={`badge ${e.refunded ? 'danger' : 'success'}`}
                        >
                          {e.refunded ? '已退費' : '正常'}
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
                  <TableCell colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
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
              className="btn-secondary"
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
              className="btn-secondary"
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
              className="btn-secondary"
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
              className="btn-secondary"
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
