import { useState, useMemo } from 'react'
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

  return (
    <div>
      <StudentFilters
        studentSearch={studentSearch}
        onSearchChange={(value) => {
          setStudentSearch(value)
          setStudentPage(1)
        }}
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
      />
      <StudentTable
        students={paginatedStudents}
        enrollments={enrollments}
        sortOrder={sortOrder}
        onToggleSort={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
        onSelectStudent={onSelectStudent}
        studentPage={studentPage}
        totalStudentPages={totalStudentPages}
        onPageChange={setStudentPage}
        totalFilteredCount={filteredStudents.length}
      />
    </div>
  )
}
