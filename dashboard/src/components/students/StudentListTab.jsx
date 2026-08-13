import { useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import usePermissions from '../../hooks/usePermissions'
import StudentFilters from './StudentFilters'
import StudentTable from './StudentTable'
import './students.css'

export default function StudentListTab({ students, enrollments, onSelectStudent, onShowAddStudent }) {
  const { role } = useAuth()
  const permissions = usePermissions(role)
  const [studentSearch, setStudentSearch] = useState('')
  const [studentGenderFilter, setStudentGenderFilter] = useState('')
  const [studentEduFilter, setStudentEduFilter] = useState('')
  const [studentPage, setStudentPage] = useState(1)
  const [sortOrder, setSortOrder] = useState('asc')
  const itemsPerPage = 10

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
        const comparison = Number(a.student_id) - Number(b.student_id)
        return sortOrder === 'asc' ? comparison : -comparison
      })
  }, [students, studentSearch, studentGenderFilter, studentEduFilter, sortOrder])

  const totalStudentPages = Math.ceil(filteredStudents.length / itemsPerPage) || 1
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * itemsPerPage, studentPage * itemsPerPage)
  const resetPage = setter => value => { setter(value); setStudentPage(1) }

  return <div>
    <StudentFilters
      studentSearch={studentSearch}
      onSearchChange={resetPage(setStudentSearch)}
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
      sortOrder={sortOrder}
      onToggleSort={() => setSortOrder(value => value === 'asc' ? 'desc' : 'asc')}
      onSelectStudent={onSelectStudent}
      studentPage={studentPage}
      totalStudentPages={totalStudentPages}
      onPageChange={setStudentPage}
      totalFilteredCount={filteredStudents.length}
    />
  </div>
}
