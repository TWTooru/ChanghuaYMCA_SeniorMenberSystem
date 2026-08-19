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

const INITIAL_ENROLLMENT_ERROR_MESSAGES = {
  INITIAL_ENROLLMENT_CREATE_FORBIDDEN: '您沒有建立會員及報名的權限',
  AUTH_ACCOUNT_REQUIRED: '無法取得目前登入帳號，請重新登入',
  PERIOD_INVALID: '請輸入有效期別，例如：第16期',
  PERIOD_DATES_REQUIRED: '請選擇開始日期與結束日期',
  PERIOD_DATE_INVALID: '日期格式不正確',
  PERIOD_DATE_ORDER_INVALID: '結束日期不得早於開始日期',
  COURSE_REQUIRED: '請至少選擇一門課程',
  FEE_AMOUNT_INVALID: '金額必須是 0 或正整數',
  HANDLED_ON_INVALID: '辦理日期格式不正確',
  INVALID_STUDENT_ID: '會員 ID 必須是大於 0 的整數',
  INVALID_BIRTH_DATE: '出生年月日格式不正確',
}

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

export async function createStudentWithInitialEnrollment(client, student, enrollment) {
  const enrollmentFields = [
    'period', 'period_start_date', 'period_end_date', 'courses', 'notes',
    'prepaid_amount', 'prepaid_receipt_number', 'tuition_fee', 'materials_fee',
    'membership_fee', 'fee_receipt_number', 'handled_by_name', 'handled_on',
  ]
  const pEnrollment = Object.fromEntries(
    enrollmentFields.map(key => [key, enrollment[key]]),
  )

  const { data, error } = await client.rpc('create_student_with_initial_enrollment', {
    p_student: student,
    p_enrollment: pEnrollment,
  })
  if (error) {
    const databaseMessage = error?.message || ''
    const code = Object.keys(INITIAL_ENROLLMENT_ERROR_MESSAGES)
      .find(key => databaseMessage.includes(key) || error?.code === key)
    if (code) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES[code])
    throw mapStudentMutationError(error)
  }
  return {
    student_id: Number(data.student_id),
    enrollment_id: Number(data.enrollment_id),
  }
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
  if (error) {
    if (error.code === '23503') {
      throw new Error('無法刪除此學員：尚有關聯的報名紀錄或收據，請先清理後再試。')
    }
    throw error
  }
}
