const MAX_PAYMENT_AMOUNT = 2147483647
const INVALID_AMOUNT_ERROR = '??敹???0 ?迤?湔'
const EMPTY_ASSIGNMENT_ERROR = '蝜唾祥蝝???撠???隤脩?'
const UNSELECTED_ASSIGNMENT_ERROR = '蝜唾祥蝝???急?豢??玨蝔'
const DUPLICATE_ASSIGNMENT_ERROR = '???隤脖??賢?曉憭?蝜唾祥蝝?'

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
