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
    const set = new Set(enrollments.map(e => e.season))
    return Array.from(set).sort(compareSeasons)
  }, [enrollments])

  const filteredHistory = useMemo(() => {
    if (!enrollments) return []
    return enrollments.filter(e => {
      const normalizedSearch = historySearch.toLowerCase()
      const matchesSearch =
        e.student_name.toLowerCase().includes(normalizedSearch) ||
        e.courses.some(c => c.toLowerCase().includes(normalizedSearch))
      
      const matchesSeason = historySeasonFilter === '' || e.season === historySeasonFilter
      
      let matchesRefund = true
      if (historyRefundFilter !== '') {
        if (historyRefundFilter === 'refunded') matchesRefund = e.refunded
        else if (historyRefundFilter === 'normal') matchesRefund = !e.refunded
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
          <label className="filter-label" htmlFor="history-search">搜尋姓名或課程</label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              id="history-search" 
              className="search-input" 
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
          <label className="filter-label" htmlFor="history-season">篩選季別</label>
          <select 
            id="history-season" 
            className="select-input"
            value={historySeasonFilter}
            onChange={(e) => {
              setHistorySeasonFilter(e.target.value)
              setHistoryPage(1)
            }}
          >
            <option value="">全部期別</option>
            {seasonsList.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="history-refund">退費狀況</label>
          <select 
            id="history-refund" 
            className="select-input"
            value={historyRefundFilter}
            onChange={(e) => {
              setHistoryRefundFilter(e.target.value)
              setHistoryPage(1)
            }}
          >
            <option value="">全部狀態</option>
            <option value="normal">正常 (無退費)</option>
            <option value="refunded">已退費</option>
          </select>
        </div>
      </div>

      {/* History Table */}
      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>季別</th>
                <th>課程</th>
                <th>退費狀況</th>
                <th>金額</th>
                <th>發票編號</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((e, idx) => {
                  const billing = summarizeEnrollmentBilling(e)

                  return (
                  <tr 
                    key={`${e.student_id}-${e.season}-${idx}`}
                    className="clickable"
                    onClick={() => {
                      const student = getStudentById(students, e.student_id)
                      if (student && onSelectEnrollment) onSelectEnrollment(student, e)
                    }}
                  >
                    <td className="table-cell-bold">{e.student_name}</td>
                    <td>{e.season}</td>
                    <td>
                      <div className="timeline-courses">
                        {e.courses.map(c => (
                          <span className="course-tag" key={c}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${e.refunded ? 'danger' : 'success'}`}>
                        {e.refunded ? '已退費' : '正常'}
                      </span>
                    </td>
                    <td>{billing.amount == null ? '--' : `NT$ ${billing.amount}`}</td>
                    <td>
                      {billing.invoiceNumbers.length > 0 ? (
                        <div className="invoice-number-list">
                          {billing.invoiceNumbers.map(invoice => <span key={invoice}>{invoice}</span>)}
                        </div>
                      ) : '--'}
                    </td>
                  </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                    未找到選課歷程。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer / Pagination */}
        <div className="table-footer">
          <div className="footer-info">
            顯示第 {filteredHistory.length > 0 ? (historyPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(historyPage * itemsPerPage, filteredHistory.length)} 筆紀錄（共 {filteredHistory.length} 筆）
          </div>
          <div className="pagination-buttons">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setHistoryPage(1)}
              disabled={historyPage === 1}
              id="btn-history-first"
              aria-label="跳至最前頁"
              title="跳至最前頁"
            >
              <ChevronsLeft size={16} style={{ display: 'block' }} />
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setHistoryPage(p => Math.max(p - 1, 1))}
              disabled={historyPage === 1}
              id="btn-history-prev"
            >
              <ChevronLeft size={16} style={{ display: 'block' }} />
            </button>
            <button 
              className="btn-secondary"
              onClick={() => setHistoryPage(p => Math.min(p + 1, totalHistoryPages))}
              disabled={historyPage === totalHistoryPages}
              id="btn-history-next"
            >
              <ChevronRight size={16} style={{ display: 'block' }} />
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setHistoryPage(totalHistoryPages)}
              disabled={historyPage === totalHistoryPages}
              id="btn-history-last"
              aria-label="跳至最尾頁"
              title="跳至最尾頁"
            >
              <ChevronsRight size={16} style={{ display: 'block' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
