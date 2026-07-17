import { useState, useMemo } from 'react'
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'

export default function StudentListTab({ students, enrollments, onSelectStudent, onShowAddStudent }) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentGenderFilter, setStudentGenderFilter] = useState('')
  const [studentAgeFilter, setStudentAgeFilter] = useState('')
  const [studentEduFilter, setStudentEduFilter] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('asc') // 'asc' or 'desc'
  const itemsPerPage = 10

  const filteredStudents = useMemo(() => {
    if (!students) return []
    const result = students.filter(s => {
      const matchesSearch = 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        String(s.student_id).toLowerCase().includes(studentSearch.toLowerCase()) ||
        (s.mobile_phone && s.mobile_phone.includes(studentSearch)) ||
        (s.address && s.address.toLowerCase().includes(studentSearch.toLowerCase()))
      
      const matchesGender = studentGenderFilter === '' || s.gender === studentGenderFilter
      
      let matchesAge = true
      if (studentAgeFilter !== '') {
        const age = s.age
        if (studentAgeFilter === 'under60') matchesAge = age && age < 60
        else if (studentAgeFilter === '60to69') matchesAge = age && age >= 60 && age < 70
        else if (studentAgeFilter === '70to79') matchesAge = age && age >= 70 && age < 80
        else if (studentAgeFilter === '80plus') matchesAge = age && age >= 80
      }
      
      let matchesEdu = true
      if (studentEduFilter !== '') {
        const edu = s.education || ''
        if (studentEduFilter === 'university') matchesEdu = edu.includes('大學') || edu.includes('專')
        else if (studentEduFilter === 'high') matchesEdu = edu.includes('高中') || edu.includes('職')
        else if (studentEduFilter === 'middle') matchesEdu = edu.includes('中')
        else if (studentEduFilter === 'primary') matchesEdu = edu.includes('小')
        else if (studentEduFilter === 'grad') matchesEdu = edu.includes('研究所')
      }
      
      return matchesSearch && matchesGender && matchesAge && matchesEdu
    })
    
    // Apply sorting
    result.sort((a, b) => {
      // Convert to string safely in case they are numbers, and compare numerically if possible
      const idA = String(a.student_id);
      const idB = String(b.student_id);
      const cmp = idA.localeCompare(idB, undefined, { numeric: true });
      return sortOrder === 'asc' ? cmp : -cmp;
    })
    
    return result
  }, [students, studentSearch, studentGenderFilter, studentAgeFilter, studentEduFilter, sortOrder])

  const paginatedStudents = useMemo(() => {
    const startIndex = (studentPage - 1) * itemsPerPage
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredStudents, studentPage])

  const totalStudentPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1

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

  return (
    <div>
      {permissions.canAddStudent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button 
          type="button"
          className="btn-primary"
          onClick={onShowAddStudent}
          id="btn-add-student"
        >
          <span>+ 新增學員資料</span>
        </button>
        </div>
      )}
      {/* Filters panel */}
      <div className="filters-panel">
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-search">全文檢索學員資訊 (支援ID、姓名、電話、地址)</label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <input 
              type="text" 
              id="student-search" 
              className="search-input" 
              placeholder="輸入姓名、電話號碼或地址..." 
              value={studentSearch}
              onChange={(e) => {
                setStudentSearch(e.target.value)
                setStudentPage(1)
              }}
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-gender">篩選性別</label>
          <select 
            id="student-gender" 
            className="select-input"
            value={studentGenderFilter}
            onChange={(e) => {
              setStudentGenderFilter(e.target.value)
              setStudentPage(1)
            }}
          >
            <option value="">全部性別</option>
            <option value="男">男</option>
            <option value="女">女</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-age">篩選年齡層</label>
          <select 
            id="student-age" 
            className="select-input"
            value={studentAgeFilter}
            onChange={(e) => {
              setStudentAgeFilter(e.target.value)
              setStudentPage(1)
            }}
          >
            <option value="">全部年齡</option>
            <option value="under60">60歲以下</option>
            <option value="60to69">60 - 69歲</option>
            <option value="70to79">70 - 79歲</option>
            <option value="80plus">80歲以上</option>
          </select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-edu">篩選學歷</label>
          <select 
            id="student-edu" 
            className="select-input"
            value={studentEduFilter}
            onChange={(e) => {
              setStudentEduFilter(e.target.value)
              setStudentPage(1)
            }}
          >
            <option value="">全部學歷</option>
            <option value="university">大專/大學</option>
            <option value="high">高中/職</option>
            <option value="middle">國中</option>
            <option value="primary">國小</option>
            <option value="grad">研究所</option>
          </select>
        </div>
      </div>

      {/* Students Table */}
      <div className="table-wrapper">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th 
                  className="clickable" 
                  onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    學員ID
                    {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
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
              {paginatedStudents.length > 0 ? (
                paginatedStudents.map(s => (
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
            顯示第 {filteredStudents.length > 0 ? (studentPage - 1) * itemsPerPage + 1 : 0} 至 {Math.min(studentPage * itemsPerPage, filteredStudents.length)} 筆學員（共 {filteredStudents.length} 筆）
          </div>
          <div className="pagination-buttons">
            <button 
              type="button"
              className="btn-secondary"
              onClick={() => setStudentPage(p => Math.max(p - 1, 1))}
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
                  onClick={() => setStudentPage(page)}
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
              onClick={() => setStudentPage(p => Math.min(p + 1, totalStudentPages))}
              disabled={studentPage === totalStudentPages}
              id="btn-student-next"
            >
              <ChevronRight size={16} style={{ display: 'block' }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
