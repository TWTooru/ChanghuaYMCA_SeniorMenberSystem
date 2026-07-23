const STUDENT_ERROR_MESSAGES = [
  ['STUDENT_ID_EXISTS', '學員編號已存在'],
  ['students_pkey', '學員編號已存在'],
  ['INVALID_STUDENT_ID', '學員編號必須是大於 0 的整數'],
  ['STUDENT_NOT_FOUND', '找不到要更新的學生'],
]

export function mapStudentMutationError(error) {
  const message = error?.message || String(error || '')
  const match = STUDENT_ERROR_MESSAGES.find(([code]) => message.includes(code))
  return match ? new Error(match[1]) : error
}

export async function createStudent(client, studentData) {
  const { error } = await client.from('students').insert([studentData])
  if (error) throw mapStudentMutationError(error)
}

export async function updateStudent(client, studentId, payload) {
  const { data, error } = await client.rpc('update_student_profile', {
    p_original_id: String(studentId),
    p_student: payload,
  })
  if (error) throw mapStudentMutationError(error)
  return data
}

export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
