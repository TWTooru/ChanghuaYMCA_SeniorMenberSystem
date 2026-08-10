import { normalizePaymentRecords } from '../domain/enrollmentPayments'

/**
 * 封裝選課與課程資料的異動；建立與更新流程均透過 RPC 維持選課與課程清單的一致性。
 */
/** 去除空白與重複值，產生可寫入 `courses` 的課程名稱清單。 */
export function normalizeSelectedCourseNames(courses = []) {
  return [...new Set(
    (Array.isArray(courses) ? courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean)
  )]
}

/**
 * 透過 `create_enrollment_with_courses` RPC 在單一交易中建立選課與課程，
 * 取代原本的前端補償式交易（先 INSERT 再手動 DELETE 回滾）。
 */
function mapEnrollmentCreateError(message) {
  return {
    ENROLLMENT_CREATE_FORBIDDEN: '您沒有建立報名紀錄的權限',
    COURSE_REQUIRED: '請至少選擇一門課程',
    SEASON_REQUIRED: '請選擇課程所屬的學期',
    STUDENT_NOT_FOUND: '找不到指定的學生資料',
    ENROLLMENT_ALREADY_EXISTS: '該學生在這個學期已經有相同的報名紀錄',
    PAYMENT_RECORDS_INVALID: '付款資料格式不正確',
    PAYMENT_COURSE_REQUIRED: '付款資料至少需要選擇一門課程',
    PAYMENT_AMOUNT_REQUIRED: '請輸入付款金額',
    PAYMENT_AMOUNT_INVALID: '付款金額必須是 0 或正整數',
    PAYMENT_COURSE_NOT_SELECTED: '付款資料中的課程必須是已選擇的課程',
    PAYMENT_COURSE_DUPLICATE: '同一門課程只能出現在一筆付款資料中',
  }[message] || message
}

export async function createEnrollmentWithCourses(client, studentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const courseNames = normalizeSelectedCourseNames(courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const paymentRecords = normalizePaymentRecords(form.paymentRecords, courseNames)

  const { data, error } = await client.rpc('create_enrollment_with_courses', {
    p_student_id: studentId,
    p_season: season,
    p_reg_type: reg_type,
    p_pre_test: pre_test,
    p_post_test: post_test,
    p_refunded: refunded ? 1 : 0,
    p_refund_info: refund_info,
    p_course_names: courseNames,
    p_payment_records: paymentRecords,
  })

  if (error) throw new Error(mapEnrollmentCreateError(error.message))
  return { enrollment_id: String(data) }
}

/**
 * 透過 `update_enrollment_with_courses` 一次更新選課中繼資料與課程清單。
 * RPC 會維護原子性；服務僅將已知錯誤碼轉為 UI 訊息。
 */
export async function updateEnrollmentWithCourses(client, enrollmentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const courseNames = normalizeSelectedCourseNames(courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const { error } = await client.rpc('update_enrollment_with_courses', {
    p_enrollment_id: enrollmentId,
    p_season: season,
    p_reg_type: reg_type,
    p_pre_test: pre_test,
    p_post_test: post_test,
    p_refunded: refunded ? 1 : 0,
    p_refund_info: refund_info,
    p_course_names: courseNames,
  })

  if (!error) return

  const mappedMessage = {
    COURSE_RECEIPT_LOCKED: '已有收據的課程不能移除',
    COURSE_REQUIRED: '請至少選擇一門課程',
  }[error.message]
  throw new Error(mappedMessage || error.message)
}

/** 依 `enrollment_id` 刪除選課；若課程仍有收據則拒絕刪除。 */
export async function deleteEnrollment(client, enrollmentId) {
  const { error } = await client.from('enrollments').delete().eq('enrollment_id', enrollmentId)
  if (!error) return

  const foreignKeyContext = `${error.message || ''} ${error.details || ''}`
  if (
    error.code === '23503'
    && (foreignKeyContext.includes('course_receipts') || foreignKeyContext.includes('billing_receipt_courses'))
  ) {
    throw new Error('此選課紀錄的課程仍有收據，請先刪除所有課程收據後再刪除選課')
  }
  throw error
}

export async function updateEnrollmentRefundStatus(client, enrollmentId, refunded, refundInfo) {
  const { error } = await client
    .from('enrollments')
    .update({ refunded: refunded ? 1 : 0, refund_info: refundInfo || null })
    .eq('enrollment_id', enrollmentId)

  if (error) throw error
}

