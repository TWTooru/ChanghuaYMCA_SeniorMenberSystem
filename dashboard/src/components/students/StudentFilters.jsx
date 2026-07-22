import { Search, UserPlus } from 'lucide-react'

export default function StudentFilters({
  studentSearch,
  onSearchChange,
  studentGenderFilter,
  onGenderChange,
  studentAgeFilter,
  onAgeChange,
  studentEduFilter,
  onEduChange,
  permissions,
  onShowAddStudent
}) {
  return (
    <div>
      {permissions?.canAddStudent && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          <button 
            type="button"
            className="btn-primary"
            onClick={onShowAddStudent}
            id="btn-add-student"
          >
            <UserPlus size={16} style={{ marginRight: '6px' }} />
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
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-gender">篩選性別</label>
          <select 
            id="student-gender" 
            className="select-input"
            value={studentGenderFilter}
            onChange={(e) => onGenderChange(e.target.value)}
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
            onChange={(e) => onAgeChange(e.target.value)}
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
            onChange={(e) => onEduChange(e.target.value)}
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
    </div>
  )
}
