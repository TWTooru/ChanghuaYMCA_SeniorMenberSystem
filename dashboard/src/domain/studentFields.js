export const EDUCATION_OPTIONS = [
  '未填寫',
  '高中/職',
  '大專/大學',
  '國小',
  '國中',
  '研究所',
  '未受正規教育但識字',
  '不識字',
  '未知'
]

/**
 * Maps loose spreadsheet and form education values into the UI's canonical
 * categories while retaining non-empty values that do not match a known rule.
 */
export function normalizeEducation(value) {
  const edu = typeof value === 'string' ? value.trim() : ''
  if (!edu || edu === '?' || edu === '？') return '未知'
  if (edu === '未填寫') return '未填寫'
  if (edu.includes('未受正規教育') || edu.includes('未受過正規教育')) return '未受正規教育但識字'
  if (edu.includes('不識字')) return '不識字'
  if (edu.includes('研究所') || edu.includes('碩') || edu.includes('博')) return '研究所'
  if (edu.includes('大學') || edu.includes('專')) return '大專/大學'
  if (edu.includes('高中') || edu.includes('職')) return '高中/職'
  if (edu.includes('小學') || edu.includes('國小')) return '國小'
  if (edu.includes('國中') || edu.includes('初中')) return '國中'
  if (edu === '未知') return '未知'
  return edu
}

/**
 * Calculates completed age using a caller-provided `today` when deterministic
 * import or display behavior is required.
 */
export function calculateAgeFromBirthDate(value, today = new Date()) {
  if (!value) return null

  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const birthYear = Number(match[1])
  const birthMonth = Number(match[2])
  const birthDay = Number(match[3])
  if (!birthYear || !birthMonth || !birthDay) return null

  let age = today.getFullYear() - birthYear
  const currentMonth = today.getMonth() + 1
  const currentDay = today.getDate()
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

/** Converts a numeric age into the display label used for the sixty-plus group. */
export function formatSixtyPlus(age) {
  return Number(age) >= 60 ? '是' : '否'
}

export function splitCourseNames(value) {
  if (!value) return []
  return String(value)
    .split(/[,，]/)
    .map(course => course.trim())
    .filter(Boolean)
}
