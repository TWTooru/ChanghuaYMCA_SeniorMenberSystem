import { cleanCourseName, cleanStr } from './excelImport'
import { normalizeSeason, seasonNumber } from './season'
import { calculateAgeFromBirthDate } from './studentFields'
import { buildStudentIdentityKey, normalizeStudentId } from './studentIdentity'

const FIXED_COLUMNS = {
  姓名: 'name', 性別: 'gender', 出生日期: 'birth_date', 地址: 'address', 家裡電話: 'home_phone',
  手機電話: 'mobile_phone', 主要聯絡人: 'emergency_contact', 關係: 'relationship',
  聯絡人電話: 'emergency_contact_phone', 教育程度: 'education', 職業: 'occupation'
}
const REQUIRED_HEADERS = ['學員編號', ...Object.keys(FIXED_COLUMNS), '目前年齡', '是否60歲']
const COURSE_HEADER = /^課程(\d+)$/

export function normalizeCsvDate(value) {
  const text = cleanStr(value)
  if (!text) return null
  const match = text.match(/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})$/)
  if (!match) return null
  const [, yearText, , monthText, dayText] = match
  if (text.includes('-') && (monthText.length !== 2 || dayText.length !== 2)) return null
  const year = Number(yearText), month = Number(monthText), day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return `${yearText}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

/**
 * 將 `CSV` 欄位與資料列轉換為單季匯入 `payload`，並只回報檔案內即可判定的格式與重複資料問題。
 * 空白 `student_id` 會保留給後續預覽以 `identity key` 對照既有學生；資料庫中的對應結果不在此解析階段決定。
 */
export function parseQuarterCsvRows(rows, { headers = [], today = new Date() } = {}) {
  const cleanHeaders = headers.map(header => String(header ?? '').trim()).filter(Boolean)
  const errors = []
  const warnings = []
  for (const header of REQUIRED_HEADERS) {
    if (!cleanHeaders.includes(header)) errors.push({ row: null, field: '表頭', message: `缺少必要欄位：${header}` })
  }

  const quarterColumns = cleanHeaders.map(header => {
    const match = header.match(/^(第(?:\d+|[一二三四五六七八九十]+)季)(前測|後測|\(新、續\))$/)
    return match ? { header, season: normalizeSeason(match[1]), kind: match[2] } : null
  }).filter(Boolean)
  const seasons = [...new Set(quarterColumns.map(column => column.season).filter(Boolean))]
  const registrationColumns = quarterColumns.filter(column => column.kind === '(新、續)')
  if (seasons.length === 0) errors.push({ row: null, field: '季度', message: '找不到季度欄位' })
  if (seasons.length > 1) errors.push({ row: null, field: '季度', message: '偵測到多個季度，功能尚未開發' })
  const season = seasons.length === 1 ? seasons[0] : null
  const seasonColumns = Object.fromEntries(quarterColumns.filter(column => column.season === season).map(column => [column.kind, column.header]))
  if (season) {
    for (const kind of ['前測', '後測', '(新、續)']) {
      if (!seasonColumns[kind]) errors.push({ row: null, field: '表頭', message: `缺少必要欄位：${season}${kind}` })
    }
  }

  const courses = cleanHeaders.map(header => {
    const match = header.match(COURSE_HEADER)
    return match ? { header, number: Number(match[1]) } : null
  }).filter(Boolean).sort((a, b) => a.number - b.number)
  if (courses.some(course => course.number < 1)) errors.push({ row: null, field: '表頭', message: '課程欄位必須從課程1開始' })
  if (!courses.some(course => course.number === 1)) errors.push({ row: null, field: '表頭', message: '缺少必要欄位：課程1' })
  for (let expected = 1; expected <= (courses.at(-1)?.number || 0); expected += 1) {
    if (!courses.some(course => course.number === expected)) {
      errors.push({ row: null, field: '表頭', message: `缺少課程${expected}` })
      break
    }
  }

  const seenIds = new Set()
  const blankIdentityRows = new Map()
  const parsedRows = rows.map((sourceRowData, index) => {
    const sourceRow = index + 2
    const row = Object.fromEntries(
      Object.entries(sourceRowData).map(([header, value]) => [String(header).trim(), value])
    )
    let providedStudentId = null
    try {
      providedStudentId = normalizeStudentId(row['學員編號'], { allowBlank: true })
    } catch (error) {
      errors.push({ row: sourceRow, field: '學員編號', message: error.message })
    }
    const student = Object.fromEntries(Object.entries(FIXED_COLUMNS).map(([header, key]) => [key, cleanStr(row[header])]))
    const birthRaw = cleanStr(row['出生日期'])
    student.birth_date = normalizeCsvDate(birthRaw)
    if (birthRaw && !student.birth_date) errors.push({ row: sourceRow, field: '出生日期', message: '日期格式無法辨識' })
    student.age = student.birth_date ? calculateAgeFromBirthDate(student.birth_date.replaceAll('/', '-'), today) : null
    student.is_60_plus = student.age === null ? null : student.age >= 60 ? '是' : '否'
    if (!student.name) errors.push({ row: sourceRow, field: '姓名', message: '姓名必填' })

    const readDate = (header) => {
      const raw = header ? cleanStr(row[header]) : null
      const normalized = normalizeCsvDate(raw)
      if (raw && !normalized) errors.push({ row: sourceRow, field: header, message: '日期格式無法辨識' })
      return normalized
    }
    const regType = seasonColumns['(新、續)'] ? cleanStr(row[seasonColumns['(新、續)']]) : null
    for (const column of registrationColumns) {
      const value = cleanStr(row[column.header])
      if (value && !['新', '續'].includes(value)) errors.push({ row: sourceRow, field: column.header, message: '只允許填寫新、續或空白' })
    }
    const enrollment = {
      season,
      reg_type: regType,
      pre_test: readDate(seasonColumns['前測']),
      post_test: readDate(seasonColumns['後測']),
      courses: [...new Set(courses.map(course => cleanCourseName(row[course.header])).filter(Boolean))]
    }
    const parsedRow = { source_row: sourceRow, provided_student_id: providedStudentId, student, enrollments: season ? [enrollment] : [] }

    if (providedStudentId) {
      if (seenIds.has(providedStudentId)) errors.push({ row: sourceRow, field: '學員編號', message: `檔案內重複編號 ${providedStudentId}` })
      seenIds.add(providedStudentId)
    } else {
      const identityKey = buildStudentIdentityKey(student)
      const firstRow = identityKey ? blankIdentityRows.get(identityKey) : null
      if (firstRow) {
        errors.push({
          row: sourceRow,
          field: '學員編號',
          message: `疑似重複學生，請先核對來源第 ${firstRow} 列`,
        })
      } else if (identityKey) {
        blankIdentityRows.set(identityKey, sourceRow)
      }
    }
    return parsedRow
  })

  return { mode: 'single-season', seasons: season ? [season] : [], rows: parsedRows, warnings, errors }
}

void seasonNumber
