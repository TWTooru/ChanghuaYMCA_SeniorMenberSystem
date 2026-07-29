function normalizeStudentId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

/**
 * Finds a student by string-normalized `student_id` so row-like sources with
 * numeric or string IDs resolve consistently; invalid lookup input yields null.
 */
export function getStudentById(students, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(students) || normalizedId === null) return null

  return students.find(student => (
    normalizeStudentId(student?.student_id) === normalizedId
  )) || null
}

/** Filters enrollment-like records by the same normalized `student_id` rule. */
export function getEnrollmentsForStudent(enrollments, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(enrollments) || normalizedId === null) return []

  return enrollments.filter(enrollment => (
    normalizeStudentId(enrollment?.student_id) === normalizedId
  ))
}
