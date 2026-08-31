import { Search, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const ALL_OPTIONS = 'all'

const genderOptions = [
  { label: '全部性別', value: ALL_OPTIONS },
  { label: '男', value: '男' },
  { label: '女', value: '女' },
]

const ageOptions = [
  { label: '全部年齡', value: ALL_OPTIONS },
  { label: '60歲以下', value: 'under60' },
  { label: '60 - 69歲', value: '60to69' },
  { label: '70 - 79歲', value: '70to79' },
  { label: '80歲以上', value: '80plus' },
]

const eduOptions = [
  { label: '全部學歷', value: ALL_OPTIONS },
  { label: '大專/大學', value: 'university' },
  { label: '高中/職', value: 'high' },
  { label: '國中', value: 'middle' },
  { label: '國小', value: 'primary' },
  { label: '研究所', value: 'grad' },
]

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
  onShowAddStudent,
  onShowMerge,
}) {
  /** 所有篩選欄位皆為受控輸入，實際篩選與頁碼重設由父元件集中管理。 */
  return (
    <div>
      {(permissions?.canAddStudent || onShowMerge) && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px', gap: '8px' }}>
          {onShowMerge && (
            <Button
              type="button"
              variant="destructive"
              onClick={onShowMerge}
            >
              <span>合併學員</span>
            </Button>
          )}
          {permissions?.canAddStudent && (
            <Button
              type="button"
              className="btn-primary"
              onClick={onShowAddStudent}
              id="btn-add-student"
            >
              <UserPlus size={16} style={{ marginRight: '6px' }} />
              <span>+ 新增學員資料</span>
            </Button>
          )}
        </div>
      )}
      {/* Filters panel */}
      <div className="filters-panel">
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-search">全文檢索學員資訊 (支援ID、姓名、電話、地址)</label>
          <div className="search-input-wrapper">
            <Search size={16} className="search-icon" />
            <Input
              type="text"
              id="student-search"
              className="search-input student-search-input"
              placeholder="輸入姓名、電話號碼或地址..."
              value={studentSearch}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-gender">篩選性別</label>
          <Select
            value={studentGenderFilter || ALL_OPTIONS}
            onValueChange={(value) => onGenderChange(value === ALL_OPTIONS ? '' : value)}
          >
            <SelectTrigger id="student-gender" className="select-input student-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {genderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-age">篩選年齡層</label>
          <Select
            value={studentAgeFilter || ALL_OPTIONS}
            onValueChange={(value) => onAgeChange(value === ALL_OPTIONS ? '' : value)}
          >
            <SelectTrigger id="student-age" className="select-input student-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ageOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="filter-group">
          <label className="filter-label" htmlFor="student-edu">篩選學歷</label>
          <Select
            value={studentEduFilter || ALL_OPTIONS}
            onValueChange={(value) => onEduChange(value === ALL_OPTIONS ? '' : value)}
          >
            <SelectTrigger id="student-edu" className="select-input student-filter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eduOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
