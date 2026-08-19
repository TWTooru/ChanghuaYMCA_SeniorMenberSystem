import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import StudentFilters from './StudentFilters'
import StudentTable from './StudentTable'
import './students.css'

export default function StudentListTab({ students, enrollments, onSelectStudent, onShowAddStudent }) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [studentSearchInput, setStudentSearchInput] = useState('')
  const [studentSearch, setStudentSearch] = useState('')
  const [studentGenderFilter, setStudentGenderFilter] = useState('')
  const [studentEduFilter, setStudentEduFilter] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [sortField, setSortField] = useState('student_id')
  const [sortOrder, setSortOrder] = useState('asc')
  const [itemsPerPage, setItemsPerPage] = useState(10)

  useEffect(() => {
    const timer = setTimeout(() => {
      setStudentSearch(studentSearchInput)
      setStudentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [studentSearchInput])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase()
    return (students ?? [])
      .filter(student => {
        const searchable = [
          student.student_id, student.name, student.email, student.phone,
          student.address, student.organization,
        ].map(value => String(value ?? '').toLowerCase())
        return (!query || searchable.some(value => value.includes(query)))
          && (!studentGenderFilter || student.gender === studentGenderFilter)
          && (!studentEduFilter || student.education === studentEduFilter)
      })
      .sort((a, b) => {
        let comparison = 0
        if (sortField === 'student_id') {
          comparison = Number(a.student_id) - Number(b.student_id)
        } else if (sortField === 'name') {
          comparison = (a.name || '').localeCompare(b.name || '', 'zh-Hant')
        } else if (sortField === 'created_at') {
          comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0)
        }
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [students, studentSearch, studentGenderFilter, studentEduFilter, sortField, sortOrder])

  const totalStudentPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * itemsPerPage, studentPage * itemsPerPage)
  const resetPage = setter => value => { setter(value); setStudentPage(1) }

  return <div>
    <StudentFilters
      studentSearch={studentSearchInput}
      onSearchChange={setStudentSearchInput}
      studentGenderFilter={studentGenderFilter}
      onGenderChange={resetPage(setStudentGenderFilter)}
      studentEduFilter={studentEduFilter}
      onEduChange={resetPage(setStudentEduFilter)}
      permissions={permissions}
      onShowAddStudent={onShowAddStudent}
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
      onPageSizeChange={resetPage(setItemsPerPage)}
    />
  </div>
}
