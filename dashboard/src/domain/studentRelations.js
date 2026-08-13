function normalizeStudentId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

/**
 * 依字串正規化後的 `student_id` 尋找學生，確保列狀來源中的數字或字串 ID
 * 都能一致比對；無效的查詢輸入會得到 null。
 */
export function getStudentById(students, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(students) || normalizedId === null) return null

  return students.find(student => (
    normalizeStudentId(student?.student_id) === normalizedId
  )) || null
}

/** 依相同的正規化 `student_id` 規則篩選類報名資料。 */
export function getEnrollmentsForStudent(enrollments, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(enrollments) || normalizedId === null) return []

  return enrollments.filter(enrollment => (
    normalizeStudentId(enrollment?.student_id) === normalizedId
  ))
}
