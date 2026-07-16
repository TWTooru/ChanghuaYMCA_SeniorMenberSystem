import { cleanCourseName, cleanDate, cleanInt, cleanScore, cleanStr } from './excelImport'
import { normalizeSeason, seasonNumber } from './season'
import { calculateAgeFromBirthDate } from './studentFields'

const STUDENT_COLUMNS = {
  姓名: 'name', 性別: 'gender', 出生日期: 'birth_date', 目前年齡: 'age', 是否60歲: 'is_60_plus',
  地址: 'address', 家裡電話: 'home_phone', 手機電話: 'mobile_phone', 主要聯絡人: 'emergency_contact',
  關係: 'relationship', 聯絡人電話: 'emergency_contact_phone', 教育程度: 'education', 職業: 'occupation'
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

function describeSeasonColumns(headers) {
  const bySeason = new Map()
  for (const header of headers) {
    const number = seasonNumber(header)
    if (number < 1) continue
    const season = normalizeSeason(header)
    const descriptor = bySeason.get(season) || { pre: null, post: null, reg: null, courses: [] }
    if (header.includes('前測') || /14期前/.test(header)) descriptor.pre = header
    else if (header.includes('後測') || /14期後/.test(header)) descriptor.post = header
    else if (header.includes('新、續') || header.includes('新/續')) descriptor.reg = header
    else if (header.includes('課程')) descriptor.courses.push(header)
    bySeason.set(season, descriptor)
  }
  if (bySeason.size === 1) {
    const descriptor = [...bySeason.values()][0]
    descriptor.courses.push(...headers.filter(header => /^課程\d+$/.test(header)))
  }
  return bySeason
}

export function parseTabularRows(rows, { today = new Date() } = {}) {
  const headers = Object.keys(rows[0] || {})
  const descriptors = describeSeasonColumns(headers)
  const hasUnprefixedCourses = headers.some(header => /^課程\d+$/.test(header))
  const mode = descriptors.size > 1 ? 'legacy-total' : 'single-season'
  const errors = []
  const warnings = []
  if (descriptors.size === 0) errors.push({ row: null, field: '季度', message: '找不到季度欄位' })
  if (descriptors.size > 1 && hasUnprefixedCourses) errors.push({ row: null, field: '季度', message: '單季度檔案包含不同季度' })

  const parsedRows = rows.map((row, index) => {
    const sourceRow = index + 2
    const student = {}
    for (const [column, key] of Object.entries(STUDENT_COLUMNS)) student[key] = cleanStr(row[column])
    student.original_id = cleanStr(row['原始編號'])
    const rawBirthDate = cleanStr(row['出生日期'])
    const birthDate = cleanDate(rawBirthDate)
    if (rawBirthDate && !isValidIsoDate(birthDate)) {
      errors.push({ row: sourceRow, field: '出生日期', message: '日期格式無法辨識' })
      student.birth_date = null
    } else student.birth_date = birthDate

    const suppliedAge = cleanInt(row['目前年齡'])
    const calculatedAge = student.birth_date ? calculateAgeFromBirthDate(student.birth_date, today) : null
    student.age = calculatedAge ?? suppliedAge
    student.is_60_plus = calculatedAge === null ? cleanStr(row['是否60歲']) : (calculatedAge >= 60 ? '是' : '否')
    if (calculatedAge !== null && suppliedAge !== null && calculatedAge !== suppliedAge) {
      warnings.push({ row: sourceRow, field: '目前年齡', message: `依出生日期重新計算為 ${calculatedAge} 歲` })
    }
    if (!student.name || student.name === 'None') errors.push({ row: sourceRow, field: '姓名', message: '姓名必填' })

    const enrollments = []
    for (const [season, descriptor] of descriptors) {
      const courses = [...new Set(descriptor.courses.map(column => cleanCourseName(row[column])).filter(Boolean))]
      const enrollment = {
        season,
        reg_type: descriptor.reg ? cleanStr(row[descriptor.reg]) : null,
        pre_test: descriptor.pre ? cleanScore(row[descriptor.pre]) : null,
        post_test: descriptor.post ? cleanScore(row[descriptor.post]) : null,
        courses
      }
      if (enrollment.reg_type || enrollment.pre_test || enrollment.post_test || courses.length) enrollments.push(enrollment)
    }
    return { source_row: sourceRow, provided_student_id: cleanStr(row['學員編號']), student, enrollments }
  })
  return { mode, seasons: [...descriptors.keys()], rows: parsedRows, warnings, errors }
}
