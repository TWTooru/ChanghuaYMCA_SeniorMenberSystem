import { useEffect, useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import StudentFilters from './StudentFilters'
import StudentTable from './StudentTable'
import StudentMergeDialog from '../admin/StudentMergeDialog'
import './students.css'

export default function StudentListTab({ students, enrollments, onSelectStudent, onShowAddStudent, onRefresh }) {
  /** 此容器保留篩選、排序與分頁狀態，並將列的呈現與操作委派給 StudentTable。 */
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentGenderFilter, setStudentGenderFilter] = useState('')
  const [studentAgeFilter, setStudentAgeFilter] = useState('')
  const [studentEduFilter, setStudentEduFilter] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [sortField, setSortField] = useState('student_id')
  const [sortOrder, setSortOrder] = useState('asc')
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    const timer = setTimeout(() => {
      setStudentSearch(studentSearchInput)
      setStudentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [studentSearchInput])

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
    
    // 以可安全比較的學員 ID 排序，讓數字與字串格式的 ID 都維持穩定順序。
    result.sort((a, b) => {
      const valueA = String(a[sortField] ?? '')
      const valueB = String(b[sortField] ?? '')
      const cmp = sortField === 'student_id'
        ? valueA.localeCompare(valueB, undefined, { numeric: true })
        : valueA.localeCompare(valueB, 'zh-Hant')
      return sortOrder === 'asc' ? cmp : -cmp;
    })
    
    return result
  }, [students, studentSearch, studentGenderFilter, studentAgeFilter, studentEduFilter, sortField, sortOrder])

  const paginatedStudents = useMemo(() => {
    const startIndex = (studentPage - 1) * itemsPerPage
    return filteredStudents.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredStudents, studentPage, itemsPerPage])

  const totalStudentPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1

  useEffect(() => {
    setStudentPage(page => Math.min(page, totalStudentPages))
  }, [totalStudentPages])

  const handleSort = (field) => {
    if (field === sortField) {
      setSortOrder(order => order === 'asc' ? 'desc' : 'asc')
      return
    }
    setSortField(field)
    setSortOrder('asc')
  }

  const handlePageSizeChange = (size) => {
    setItemsPerPage(size)
    setStudentPage(1)
  }

  return (
    <div>
      <StudentFilters
        studentSearch={studentSearchInput}
        onSearchChange={setStudentSearchInput}
        studentGenderFilter={studentGenderFilter}
        onGenderChange={(value) => {
          setStudentGenderFilter(value)
          setStudentPage(1)
        }}
        studentAgeFilter={studentAgeFilter}
        onAgeChange={(value) => {
          setStudentAgeFilter(value)
          setStudentPage(1)
        }}
        studentEduFilter={studentEduFilter}
        onEduChange={(value) => {
          setStudentEduFilter(value)
          setStudentPage(1)
        }}
        permissions={permissions}
        onShowAddStudent={onShowAddStudent}
        onShowMerge={permissions.canDeleteStudent ? () => setShowMergeDialog(true) : undefined}
      />
      <StudentTable
        students={paginatedStudents}
        enrollments={enrollments}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        onSelectStudent={onSelectStudent}
        studentPage={studentPage}
        totalStudentPages={totalStudentPages}
        onPageChange={setStudentPage}
        totalFilteredCount={filteredStudents.length}
        itemsPerPage={itemsPerPage}
        onPageSizeChange={handlePageSizeChange}
      />
      {showMergeDialog && (
        <StudentMergeDialog
          students={students}
          onClose={() => setShowMergeDialog(false)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}
