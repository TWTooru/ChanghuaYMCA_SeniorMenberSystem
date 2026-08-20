import { normalizeInitialEnrollmentForm } from '../domain/initialEnrollment'
import { normalizePaymentRecords } from '../domain/enrollmentPayments'
import { normalizePeriod } from '../domain/period'

/**
 * 封裝選課、報名表與課程資料的異動；建立與更新流程均透過 RPC 維持選課、報名表與課程清單的一致性。
 */

/** 去除空白與重複值，產生可寫入 `courses` 的課程名稱清單。 */
export function normalizeSelectedCourseNames(courses = []) {
  return [...new Set(
    (Array.isArray(courses) ? courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean)
  )]
}

function mapEnrollmentError(message) {
  const map = {
    ENROLLMENT_CREATE_FORBIDDEN: '您沒有建立報名紀錄的權限',
    ENROLLMENT_UPDATE_FORBIDDEN: '您沒有修改報名紀錄的權限',
    ENROLLMENT_DELETE_FORBIDDEN: '只有管理員可以刪除報名單',
    ENROLLMENT_FORM_NOT_FOUND: '找不到指定的報名表',
    ENROLLMENT_NOT_FOUND: '找不到指定的報名紀錄',
    COURSE_REQUIRED: '請至少選擇一門課程',
    PERIOD_INVALID: '請輸入有效期別，例如：第16期',
    PERIOD_DATES_REQUIRED: '請選擇開始日期與結束日期',
    PERIOD_DATE_INVALID: '開始或結束日期格式不正確',
    PERIOD_DATE_ORDER_INVALID: '結束日期不能早於開始日期',
    PERIOD_DATE_MISMATCH: '報名表所屬期別的起訖日期與現有紀錄不一致',
    STUDENT_NOT_FOUND: '找不到指定的學生資料',
    ENROLLMENT_ALREADY_EXISTS: '該會員在這個期別已經有相同的報名紀錄',
    DUPLICATE_COURSE_IN_ENROLLMENT: '同一期別內已有其他報名表包含相同的課程',
    COURSE_RECEIPT_LOCKED: '已有收據的課程不能移除',
    FEE_AMOUNT_INVALID: '金額必須為 0 或正整數',
    REPORTED_ON_INVALID: '辦理日期格式不正確',
    HANDLED_ON_INVALID: '辦理日期格式不正確',
    AUTH_ACCOUNT_REQUIRED: '請先登入後再進行操作',
  }
  return map[message] || message
}

/**
 * 透過 `create_member_enrollment` RPC 在單一交易中建立選課、報名表、課程與收據明細。
 */
export async function createEnrollmentForm(client, studentId, form) {
  const normalized = normalizeInitialEnrollmentForm(form)

  const { data, error } = await client.rpc('create_member_enrollment', {
    p_student_id: Number(studentId),
    p_enrollment: normalized,
  })

  if (error) throw new Error(mapEnrollmentError(error.message))
  return {
    enrollment_id: Number(data.enrollment_id),
    form_id: Number(data.form_id),
    form_sequence: Number(data.form_sequence),
  }
}

export async function createEnrollmentWithCourses(client, studentId, form) {
  return createEnrollmentForm(client, studentId, form)
}

/**
 * 透過 `update_enrollment_form` RPC 更新單一報名表的課程與收據明細。
 */
export async function updateEnrollmentForm(client, formId, form) {
  const courseNames = normalizeSelectedCourseNames(form.courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const reportedOn = String(form.reported_on ?? form.handled_on ?? '').trim() || null

  const formPayload = {
    reg_type: String(form.reg_type ?? '').trim() || '續',
    courses: courseNames,
    notes: String(form.notes ?? '').trim() || null,
    prepaid_amount: form.prepaid_amount != null && form.prepaid_amount !== '' ? Number(form.prepaid_amount) : null,
    prepaid_receipt_number: String(form.prepaid_receipt_number ?? '').trim() || null,
    tuition_fee: form.tuition_fee != null && form.tuition_fee !== '' ? Number(form.tuition_fee) : null,
    materials_fee: form.materials_fee != null && form.materials_fee !== '' ? Number(form.materials_fee) : null,
    membership_fee: form.membership_fee != null && form.membership_fee !== '' ? Number(form.membership_fee) : null,
    fee_receipt_number: String(form.fee_receipt_number ?? '').trim() || null,
    handled_by_name: String(form.handled_by_name ?? '').trim() || null,
    reported_on: reportedOn,
    handled_on: reportedOn,
  }

  const { error } = await client.rpc('update_enrollment_form', {
    p_form_id: Number(formId),
    p_form: formPayload,
  })

  if (error) throw new Error(mapEnrollmentError(error.message))
}

/**
 * 透過 `set_enrollment_form_refund` RPC 設定單一報名表的退費狀態。
 */
export async function updateEnrollmentFormRefundStatus(client, formId, refunded, refundInfo) {
  const { error } = await client.rpc('set_enrollment_form_refund', {
    p_form_id: Number(formId),
    p_refunded: Boolean(refunded),
    p_refund_info: refundInfo || null,
  })

  if (error) throw new Error(mapEnrollmentError(error.message))
}

/**
 * 透過 `delete_enrollment_form` RPC 刪除單一報名表（若為最後一張則連帶刪除 enrollment）。
 */
export async function deleteEnrollmentForm(client, formId) {
  const { data, error } = await client.rpc('delete_enrollment_form', {
    p_form_id: Number(formId),
  })

  if (error) throw new Error(mapEnrollmentError(error.message))
  return {
    form_id: Number(data.form_id),
    enrollment_deleted: Boolean(data.enrollment_deleted),
  }
}

/**
 * 透過 `update_enrollment_period` RPC 僅更新期別與起訖日期。
 */
export async function updateEnrollmentPeriod(client, enrollmentId, periodData = {}) {
  const period = normalizePeriod(periodData.period)
  if (!period) throw new Error(mapEnrollmentError('PERIOD_INVALID'))

  const startDate = String(periodData.period_start_date ?? '').trim()
  const endDate = String(periodData.period_end_date ?? '').trim()
  if (!startDate || !endDate) throw new Error(mapEnrollmentError('PERIOD_DATES_REQUIRED'))
  if (endDate < startDate) throw new Error(mapEnrollmentError('PERIOD_DATE_ORDER_INVALID'))

  const { error } = await client.rpc('update_enrollment_period', {
    p_enrollment_id: Number(enrollmentId),
    p_period: period,
    p_period_start_date: startDate,
    p_period_end_date: endDate,
  })

  if (error) throw new Error(mapEnrollmentError(error.message))
}

// Legacy helpers retained for backward compatibility
export async function updateEnrollmentWithCourses(client, enrollmentId, form) {
  const { period, reg_type, refunded, refund_info, courses } = form
  const courseNames = normalizeSelectedCourseNames(courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const { error } = await client.rpc('update_enrollment_with_courses', {
    p_enrollment_id: Number(enrollmentId),
    p_period: period,
    p_reg_type: reg_type,
    p_refunded: refunded ? 1 : 0,
    p_refund_info: refund_info || null,
    p_course_names: courseNames,
    p_payment_records: normalizePaymentRecords(form.paymentRecords, courseNames),
  })

  if (!error) return
  throw new Error(mapEnrollmentError(error.message))
}

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
