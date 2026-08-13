const STUDENT_ERROR_MESSAGES = [
  ['STUDENT_ID_EXISTS', '會員 ID 已被使用'],
  ['students_pkey', '會員 ID 已被使用'],
  ['INVALID_STUDENT_ID', '會員 ID 必須是大於 0 的整數'],
  ['DUPLICATE_EMAIL', '電子郵件已被其他會員使用'],
  ['students_email', '電子郵件已被其他會員使用'],
  ['23505', '電子郵件已被其他會員使用'],
  ['STUDENT_NOT_FOUND', '找不到要更新的會員'],
  ['INVALID_PROFILE_PAYLOAD', '會員資料格式不正確'],
  ['23514', '會員資料不符合必填欄位、性別或教育程度限制'],
]

export function mapStudentMutationError(error) {
  const message = error?.message || String(error || '')
  const match = STUDENT_ERROR_MESSAGES.find(([code]) => message.includes(code) || error?.code === code)
  return match ? new Error(match[1]) : error
}

export async function createStudent(client, profile) {
  const { student_id: studentId, ...profileFields } = profile
  const insertProfile = studentId == null || studentId === '' ? profileFields : profile
  const { data, error } = await client
    .from('students')
    .insert(insertProfile)
    .select('*')
    .single()
  if (error) throw mapStudentMutationError(error)
  return data
}

export async function updateStudent(client, originalId, profile) {
  const { data, error } = await client.rpc('update_student_profile', {
    p_original_id: Number(originalId),
    p_student: profile,
  })
  if (error) throw mapStudentMutationError(error)
  return data
}

export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
