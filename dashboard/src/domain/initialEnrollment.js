import { normalizePeriod } from './period'

export const INITIAL_ENROLLMENT_ERROR_MESSAGES = {
  period: '請輸入有效期別，例如：第16期',
  datesRequired: '請選擇開始日期與結束日期',
  dateOrder: '結束日期不得早於開始日期',
  courses: '請至少選擇一門課程',
  amount: '金額必須是 0 或正整數',
}

const INTEGER_MAX = 2147483647
const MONEY_KEYS = ['prepaid_amount', 'tuition_fee', 'materials_fee', 'membership_fee']
const OPTIONAL_TEXT_KEYS = [
  'notes', 'prepaid_receipt_number', 'fee_receipt_number', 'handled_by_name',
  'refund_info',
]

function optionalMoney(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!/^\d+$/.test(text)) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount > INTEGER_MAX) {
    throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
  }
  return amount
}

export function normalizeInitialEnrollmentForm(form) {
  const period = normalizePeriod(form.period)
  if (!period) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.period)

  const startDate = String(form.period_start_date ?? '').trim()
  const endDate = String(form.period_end_date ?? '').trim()
  if (!startDate || !endDate) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.datesRequired)
  if (endDate < startDate) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.dateOrder)

  const courses = [...new Set(
    (Array.isArray(form.courses) ? form.courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean),
  )]
  if (courses.length === 0) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.courses)

  const reportedOn = String(form.reported_on ?? form.handled_on ?? '').trim() || null

  const normalized = {
    period,
    period_start_date: startDate,
    period_end_date: endDate,
    courses,
    reg_type: String(form.reg_type ?? '').trim() || '續',
    refunded: Boolean(form.refunded),
    reported_on: reportedOn,
    handled_on: reportedOn,
  }
  for (const key of OPTIONAL_TEXT_KEYS) normalized[key] = String(form[key] ?? '').trim() || null
  for (const key of MONEY_KEYS) normalized[key] = optionalMoney(form[key])
  return normalized
}
