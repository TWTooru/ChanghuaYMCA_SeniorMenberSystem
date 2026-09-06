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
import { EDUCATION_OPTIONS } from '../../domain/studentFields'

const ALL_OPTIONS = 'all'
const genderOptions = [
  { label: '全部性別', value: ALL_OPTIONS },
  { label: '男', value: '男' },
  { label: '女', value: '女' },
]
const educationOptions = [
  { label: '全部教育程度', value: ALL_OPTIONS },
  ...EDUCATION_OPTIONS.map(value => ({ label: value, value })),
]

export default function StudentFilters({ studentSearch, onSearchChange, studentGenderFilter, onGenderChange, studentEduFilter, onEduChange, permissions, onShowAddStudent }) {
  return <div>
    {permissions?.canAddStudent && <div className="student-list-actions">
      <Button type="button" onClick={onShowAddStudent} id="btn-add-student"><UserPlus />新增會員</Button>
    </div>}
    <div className="filters-panel student-filters-panel">
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-search">搜尋會員（ID、姓名、電子郵件、電話、通訊處、服務機關 / 學校）</label>
        <div className="search-input-wrapper">
          <Search className="search-icon" />
          <Input
            id="student-search"
            className="student-search-input"
            type="text"
            value={studentSearch}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="輸入會員資料搜尋"
          />
        </div>
      </div>
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-gender">性別</label>
        <Select
          items={genderOptions}
          value={studentGenderFilter || ALL_OPTIONS}
          onValueChange={value => onGenderChange(value === ALL_OPTIONS ? '' : value)}
        >
          <SelectTrigger id="student-gender" className="student-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {genderOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="filter-group">
        <label className="filter-label" htmlFor="student-edu">教育程度</label>
        <Select
          items={educationOptions}
          value={studentEduFilter || ALL_OPTIONS}
          onValueChange={value => onEduChange(value === ALL_OPTIONS ? '' : value)}
        >
          <SelectTrigger id="student-edu" className="student-filter-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {educationOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  </div>
}
