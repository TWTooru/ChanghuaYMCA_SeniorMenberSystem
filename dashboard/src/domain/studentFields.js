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
 * 將試算表與表單中寬鬆的學歷值對應至 UI 的標準分類，
 * 並保留不符合既有規則的非空白值。
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
 * 在需要可重現的匯入或顯示結果時，使用呼叫端傳入的 `today`
 * 計算已滿年齡。
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

/** 將數值年齡轉換為六十歲以上群組使用的顯示標籤。 */
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
