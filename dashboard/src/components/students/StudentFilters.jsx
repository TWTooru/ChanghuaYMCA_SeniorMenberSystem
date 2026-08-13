import { Search, UserPlus } from 'lucide-react'
import { EDUCATION_OPTIONS } from '../../domain/studentFields'

export default function StudentFilters({ studentSearch, onSearchChange, studentGenderFilter, onGenderChange, studentEduFilter, onEduChange, permissions, onShowAddStudent }) {
  return <div>
    {permissions?.canAddStudent && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
      <button type="button" className="btn-primary" onClick={onShowAddStudent} id="btn-add-student"><UserPlus size={16} style={{ marginRight: '6px' }} />新增會員</button>
    </div>}
    <div className="filters-panel">
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-search">搜尋會員（ID、姓名、電子郵件、電話、通訊處、服務機關 / 學校）</label>
        <div className="search-input-wrapper"><Search size={16} className="search-icon" /><input id="student-search" className="search-input" type="text" value={studentSearch} onChange={event => onSearchChange(event.target.value)} /></div>
      </div>
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-gender">性別</label>
        <select id="student-gender" className="select-input" value={studentGenderFilter} onChange={event => onGenderChange(event.target.value)}><option value="">全部性別</option><option value="男">男</option><option value="女">女</option></select>
      </div>
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-edu">教育程度</label>
        <select id="student-edu" className="select-input" value={studentEduFilter} onChange={event => onEduChange(event.target.value)}><option value="">全部教育程度</option>{EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select>
      </div>
    </div>
  </div>
}
