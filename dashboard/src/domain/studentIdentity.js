export const STUDENT_ID_VALIDATION_MESSAGE = '學生 ID 必須是大於 0 的整數'

export function normalizeStudentId(value, { allowBlank = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text && allowBlank) return null
  if (!/^\d+$/.test(text)) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)

  const normalized = text.replace(/^0+/, '')
  if (!normalized) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)
  return normalized
}

export function normalizeIdentityDate(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return ''

  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

export function buildStudentIdentityKey(student) {
  const name = String(student?.name ?? '').trim()
  const gender = String(student?.gender ?? '').trim()
  const birthDate = normalizeIdentityDate(student?.birth_date)
  if (!name || !gender || !birthDate) return null
  return JSON.stringify([name, gender, birthDate])
}
