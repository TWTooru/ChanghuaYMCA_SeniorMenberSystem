export const EDUCATION_OPTIONS = ['國中以下', '高中', '專科/大學', '研究所']

export function normalizeEducation(value) {
  const education = String(value ?? '').trim()
  return EDUCATION_OPTIONS.includes(education) ? education : null
}

// Kept until the legacy quarter-import module is removed in Task 8.
export function calculateAgeFromBirthDate(value, today = new Date()) {
  const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return null

  const [year, month, day] = match.slice(1).map(Number)
  const birthDate = new Date(year, month - 1, day)
  if (birthDate.getFullYear() !== year || birthDate.getMonth() !== month - 1 || birthDate.getDate() !== day) return null

  let age = today.getFullYear() - year
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1
  return age >= 0 ? age : null
}

export function formatSixtyPlus(age) {
  return Number(age) >= 60 ? '是' : '否'
}

export function splitCourseNames(value) {
  return String(value ?? '').split(/[,，]/).map(course => course.trim()).filter(Boolean)
}
