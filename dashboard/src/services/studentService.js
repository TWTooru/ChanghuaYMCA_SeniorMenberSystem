/**
 * 封裝學員資料的讀寫，統一處理由呼叫端傳入的 Supabase client 與資料庫錯誤。
 * 完整資料更新委由 `update_student_profile` RPC，以支援 `student_id` 的原子變更。
 */
const STUDENT_ERROR_MESSAGES = [
  ['STUDENT_ID_EXISTS', '學員編號已存在'],
  ['students_pkey', '學員編號已存在'],
  ['INVALID_STUDENT_ID', '學員編號必須是大於 0 的整數'],
  ['STUDENT_NOT_FOUND', '找不到要更新的學生'],
]

/** 將資料庫的學員異動錯誤碼轉為介面可顯示的穩定訊息。 */
export function mapStudentMutationError(error) {
  const message = error?.message || String(error || '')
  const match = STUDENT_ERROR_MESSAGES.find(([code]) => message.includes(code))
  return match ? new Error(match[1]) : error
}

/** 新增一筆已由呼叫端正規化的 `students` 資料列。 */
export async function createStudent(client, studentData) {
  const { error } = await client.from('students').insert([studentData])
  if (error) throw mapStudentMutationError(error)
}

/**
 * 透過 `update_student_profile` 原子更新完整學員資料；`p_original_id` 保留修改前的
 * `student_id`，因此可安全處理學員編號變更。
 */
export async function updateStudent(client, studentId, payload) {
  const { data, error } = await client.rpc('update_student_profile', {
    p_original_id: String(studentId),
    p_student: payload,
  })
  if (error) throw mapStudentMutationError(error)
  return data
}

/** 依 `student_id` 刪除學員；關聯資料由資料庫的級聯規則處理。 */
export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
