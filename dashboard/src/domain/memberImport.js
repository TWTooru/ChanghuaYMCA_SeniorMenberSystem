import { cleanDate, cleanStr } from './excelImport'
import { EDUCATION_OPTIONS } from './studentFields'
import { normalizeEmail } from './studentIdentity'

export const MEMBER_IMPORT_HEADERS = [
  '電子郵件地址', '姓名', '性別', '電話 / 手機號碼', '出生年月日',
  '通訊處', '服務機關 / 學校', '教育程度',
]

const MEMBER_HEADER_ALIASES = {
  '電話/手機號碼': '電話 / 手機號碼',
  '服務機關/學校': '服務機關 / 學校',
}

export function normalizeMemberHeader(header) {
  const normalized = String(header ?? '').trim()
  return MEMBER_HEADER_ALIASES[normalized] || normalized
}

const FIELD_BY_HEADER = {
  電子郵件地址: 'email', 姓名: 'name', 性別: 'gender', '電話 / 手機號碼': 'phone',
  出生年月日: 'birth_date', 通訊處: 'address', '服務機關 / 學校': 'organization', 教育程度: 'education',
}

const emailIsValid = value => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const normalizeGender = value => {
  const gender = cleanStr(value)
  return { 男性: '男', 女性: '女' }[gender] || gender
}

export function parseMemberRows(rows, { headers = [] } = {}) {
  const normalizedHeaders = headers.map(normalizeMemberHeader).filter(Boolean)
  const errors = []
  const warnings = []
  for (const header of MEMBER_IMPORT_HEADERS) {
    if (!normalizedHeaders.includes(header)) errors.push({ row: null, field: '表頭', message: `缺少必要欄位：${header}` })
  }

  const parsedRows = rows.map((source, index) => {
    const sourceRow = index + 2
    const row = Object.fromEntries(Object.entries(source || {}).map(([key, value]) => [normalizeMemberHeader(key), value]))
    const student = Object.fromEntries(Object.entries(FIELD_BY_HEADER).map(([header, field]) => [field, cleanStr(row[header])]))
    student.email = normalizeEmail(student.email)
    student.gender = normalizeGender(student.gender)
    student.birth_date = cleanDate(row['出生年月日'])

    if (!student.name) errors.push({ row: sourceRow, field: '姓名', message: '姓名必填' })
    if (!['男', '女'].includes(student.gender)) errors.push({ row: sourceRow, field: '性別', message: '性別只允許男或女' })
    if (!EDUCATION_OPTIONS.includes(student.education)) errors.push({ row: sourceRow, field: '教育程度', message: '教育程度不符合允許值' })
    if (!emailIsValid(student.email)) errors.push({ row: sourceRow, field: '電子郵件地址', message: '電子郵件格式不正確' })
    if (cleanStr(row['出生年月日']) && !/^\d{4}-\d{2}-\d{2}$/.test(student.birth_date || '')) {
      errors.push({ row: sourceRow, field: '出生年月日', message: '出生年月日格式不正確' })
    }

    return { source_row: sourceRow, student }
  })

  return { rows: parsedRows, warnings, errors, hasBlockingErrors: errors.length > 0 }
}
