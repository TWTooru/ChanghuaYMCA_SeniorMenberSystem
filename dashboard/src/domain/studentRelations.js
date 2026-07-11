function normalizeStudentId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export function getStudentById(students, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(students) || normalizedId === null) return null

  return students.find(student => (
    normalizeStudentId(student?.student_id) === normalizedId
  )) || null
}

export function getEnrollmentsForStudent(enrollments, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(enrollments) || normalizedId === null) return []

  return enrollments.filter(enrollment => (
    normalizeStudentId(enrollment?.student_id) === normalizedId
  ))
}
