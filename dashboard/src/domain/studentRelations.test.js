import { describe, expect, it } from 'vitest'
import { getEnrollmentsForStudent, getStudentById } from './studentRelations'

const students = [
  { student_id: 1, name: '王小明', phone: '0912-345-678', organization: '社區大學' },
  { student_id: 2, name: '李小華', phone: '0922-345-678', organization: 'YMCA' },
]

const enrollments = [
  { enrollment_id: 10, student_id: 1, student_name: '王小明', period: '第1期' },
  { enrollment_id: 11, student_id: 2, student_name: '李小華', period: '第2期' },
]

describe('student relations', () => {
  it('finds a member by numeric ID instead of name', () => {
    expect(getStudentById(students, 2)).toBe(students[1])
  })

  it('returns null for missing IDs and only the requested member enrollments', () => {
    expect(getStudentById(students, '')).toBeNull()
    expect(getEnrollmentsForStudent(enrollments, 2)).toEqual([enrollments[1]])
    expect(getEnrollmentsForStudent(enrollments, null)).toEqual([])
  })
})
