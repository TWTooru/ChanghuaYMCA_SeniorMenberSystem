const MAX_PAYMENT_AMOUNT = 2147483647
const INVALID_AMOUNT_ERROR = '金額必須為 0 或正整數'
const EMPTY_ASSIGNMENT_ERROR = '繳費紀錄必須至少選擇一門課程'
const UNSELECTED_ASSIGNMENT_ERROR = '繳費紀錄包含未選擇的課程'
const DUPLICATE_ASSIGNMENT_ERROR = '同一門課不能出現在多筆繳費紀錄'

export function normalizePaymentAmount(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) throw new Error(INVALID_AMOUNT_ERROR)

  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_PAYMENT_AMOUNT) {
    throw new Error(INVALID_AMOUNT_ERROR)
  }
  return amount
}

function normalizeCourseNames(courseNames) {
  const names = Array.isArray(courseNames) ? courseNames : []
  return [...new Set(names.map(name => String(name ?? '').trim()).filter(Boolean))]
}

export function normalizePaymentRecords(records, selectedCourseNames) {
  const selected = new Set((selectedCourseNames || []).map(name => String(name).trim()))
  const assigned = new Set()

  return (records || []).map(record => {
    const courseNames = normalizeCourseNames(record.courseNames)
    if (courseNames.length === 0) throw new Error(EMPTY_ASSIGNMENT_ERROR)
    if (courseNames.some(name => !selected.has(name))) throw new Error(UNSELECTED_ASSIGNMENT_ERROR)
    if (courseNames.some(name => assigned.has(name))) throw new Error(DUPLICATE_ASSIGNMENT_ERROR)
    courseNames.forEach(name => assigned.add(name))

    const invoice = String(record.invoiceNumber ?? '').trim()
    return {
      course_names: courseNames,
      amount: normalizePaymentAmount(record.amount),
      invoice_number: invoice || null,
    }
  })
}

export function reconcilePaymentRecords(records, selectedCourseNames) {
  const selected = new Set((selectedCourseNames || []).map(name => String(name).trim()))
  return (records || [])
    .map(record => ({
      ...record,
      courseNames: (Array.isArray(record.courseNames) ? record.courseNames : [])
        .filter(name => selected.has(String(name).trim())),
    }))
    .filter(record => record.courseNames.length > 0)
}
