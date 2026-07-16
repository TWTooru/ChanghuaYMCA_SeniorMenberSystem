import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { getStudentById } from '../../domain/studentRelations'

export default function EnrollmentTab({ students, enrollments, onSelectStudent }) {
  const [historySearch, setHistorySearch] = useState('')
  const [historySeasonFilter, setHistorySeasonFilter] = useState('')
  const [historyRegFilter, setHistoryRegFilter] = useState('')
  const [historyRefundFilter, setHistoryRefundFilter] = useState('')
  const [historyPage, setHistoryPage] = useState(1)
  const itemsPerPage = 10

  const seasonsList = useMemo(() => {
    if (!enrollments) return []
    const set = new Set(enrollments.map(e => e.season))
    return Array.from(set)
  }, [enrollments])

  const filteredHistory = useMemo(() => {
    if (!enrollments) return []
    return enrollments.filter(e => {
      const matchesSearch = 
        e.student_name.toLowerCase().includes(historySearch.toLowerCase()) ||
        String(e.student_id).toLowerCase().includes(historySearch.toLowerCase()) ||
        e.courses.some(c => c.toLowerCase().includes(historySearch.toLowerCase()))
      
      const matchesSeason = historySeasonFilter === '' || e.season === historySeasonFilter
      const matchesReg = historyRegFilter === '' || e.reg_type === historyRegFilter
      
      let matchesRefund = true
      if (historyRefundFilter !== '') {
        if (historyRefundFilter === 'refunded') matchesRefund = e.refunded
        else if (historyRefundFilter === 'normal') matchesRefund = !e.refunded
      }
      
      return matchesSearch && matchesSeason && matchesReg && matchesRefund
    })
  }, [enrollments, historySearch, historySeasonFilter, historyRegFilter, historyRefundFilter])

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
          <label className="filter-label" htmlFor="history-search">檢索姓名與選修課程</label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              id="history-search" 
              className="search-input" 
              placeholder="輸入姓名、ID或課程名稱搜尋..." 
              value={historySearch}
              onChange={(e) => {
                setHistorySearch(e.target.value)
                setHistoryPage(1)
              }}
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="history-season">篩選修課期別</label>
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
          <label className="filter-label" htmlFor="history-reg">新/續生</label>
          <select 
            id="history-reg" 
            className="select-input"
            value={historyRegFilter}
            onChange={(e) => {
              setHistoryRegFilter(e.target.value)
              setHistoryPage(1)
            }}
          >
            <option value="">全部</option>
            <option value="新">新</option>
            <option value="續">續</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="history-refund">退費狀態</label>
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
          <table className="data-table enrollment-history-table">
            <thead>
              <tr>
                <th>學員ID</th>
                <th>姓名</th>
                <th>修課期別</th>
                <th>新/續</th>
                <th>退費狀態</th>
                <th>選修課程</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {paginatedHistory.length > 0 ? (
                paginatedHistory.map((e, idx) => (
                  <tr 
                    key={`${e.student_id}-${e.season}-${idx}`}
                    className="clickable"
                    onClick={() => {
                      const student = getStudentById(students, e.student_id)
                      if (student && onSelectStudent) onSelectStudent(student, 'history')
                    }}
                  >
                    <td className="table-cell-bold">{e.student_id}</td>
                    <td className="table-cell-bold">{e.student_name}</td>
                    <td>{e.season}</td>
                    <td>
                      {e.reg_type ? (
                        <span className={`badge ${e.reg_type === '新' ? 'success' : 'neutral'}`}>
                          {e.reg_type}
                        </span>
                      ) : '--'}
                    </td>
                    <td>
                      <span className={`badge ${e.refunded ? 'danger' : 'success'}`}>
                        {e.refunded ? '已退費' : '正常'}
                      </span>
                    </td>
                    <td>
                      <div className="timeline-courses">
                        {e.courses.map(c => (
                          <span className="course-tag" key={c}>{c}</span>
                        ))}
                      </div>
                    </td>
                    <td className="enrollment-history-note">{e.refund_info || '--'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
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
          </div>
        </div>
      </div>
    </div>
  )
}
