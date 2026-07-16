import { describe, expect, it } from 'vitest'
import { getEnrollmentsForStudent, getStudentById } from './studentRelations'

const students = [
  { student_id: '1', name: '王小明' },
  { student_id: '2', name: '王小明' }
]

const enrollments = [
  { enrollment_id: 10, student_id: '1', student_name: '王小明', season: '第十四季' },
  { enrollment_id: 11, student_id: 2, student_name: '王小明', season: '第十五季' }
]

describe('studentRelations', () => {
  it('finds a student by normalized student_id instead of name', () => {
    expect(getStudentById(students, 2)).toBe(students[1])
  })

  it('returns null for missing or invalid student_id values', () => {
    expect(getStudentById(students, '999')).toBeNull()
    expect(getStudentById(students, '')).toBeNull()
    expect(getStudentById(null, '1')).toBeNull()
  })

  it('filters enrollments by normalized student_id when names are identical', () => {
    expect(getEnrollmentsForStudent(enrollments, '2')).toEqual([enrollments[1]])
  })

  it('returns an empty array for missing or invalid enrollment inputs', () => {
    expect(getEnrollmentsForStudent(enrollments, '999')).toEqual([])
    expect(getEnrollmentsForStudent(enrollments, null)).toEqual([])
    expect(getEnrollmentsForStudent(undefined, '1')).toEqual([])
  })
})
