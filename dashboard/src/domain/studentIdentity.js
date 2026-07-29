export const STUDENT_ID_VALIDATION_MESSAGE = '學生 ID 必須是大於 0 的整數'

/**
 * 將輸入的學生 ID 轉換為不含前導零的標準形式。
 * 僅在呼叫端明確啟用 `allowBlank` 時接受空白輸入。
 */
export function normalizeStudentId(value, { allowBlank = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text && allowBlank) return null
  if (!/^\d+$/.test(text)) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)

  const normalized = text.replace(/^0+/, '')
  if (!normalized) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)
  return normalized
}

/**
 * 將可接受輸入格式中的有效曆法日期轉換為穩定的身分日期表示，
 * 供比對學生資料時使用。
 */
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

/**
 * 當資料無法以 `student_id` 比對時建立備援身分鍵；
 * 三個識別欄位都必須存在。
 */
export function buildStudentIdentityKey(student) {
  const name = String(student?.name ?? '').trim()
  const gender = String(student?.gender ?? '').trim()
  const birthDate = normalizeIdentityDate(student?.birth_date)
  if (!name || !gender || !birthDate) return null
  return JSON.stringify([name, gender, birthDate])
}
