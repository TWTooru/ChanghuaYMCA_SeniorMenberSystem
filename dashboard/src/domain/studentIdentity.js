export const STUDENT_ID_VALIDATION_MESSAGE = '會員 ID 必須是大於 0 的整數'

export function normalizeStudentId(value, { allowBlank = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text && allowBlank) return null
  if (!/^\d+$/.test(text)) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)

  const id = Number(text)
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)
  return id
}

export function normalizeEmail(value) {
  const email = String(value ?? '').trim().toLowerCase()
  return email || null
}

export function normalizePhoneForIdentity(value) {
  const phone = String(value ?? '').replace(/\D/g, '')
  return phone || null
}

export function normalizeIdentityDate(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!match) return ''

  const [year, month, day] = match.slice(1).map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

export function buildStudentIdentityKey(student) {
  const name = String(student?.name ?? '').trim()
  const phone = normalizePhoneForIdentity(student?.phone)
  const birthDate = normalizeIdentityDate(student?.birth_date)
  return name && phone && birthDate ? JSON.stringify([name, phone, birthDate]) : null
}
