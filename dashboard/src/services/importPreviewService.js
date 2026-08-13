import { buildStudentIdentityKey, normalizeEmail, normalizePhoneForIdentity } from '../domain/studentIdentity'

const MEMBER_FIELD_LABELS = {
  email: '電子郵件地址', name: '姓名', gender: '性別', phone: '電話 / 手機號碼',
  birth_date: '出生年月日', address: '通訊處', organization: '服務機關 / 學校', education: '教育程度',
}

const normalizeComparable = (field, value) => {
  if (value === null || value === undefined || value === '') return null
  if (field === 'email') return normalizeEmail(value)
  if (field === 'phone') return normalizePhoneForIdentity(value)
  return String(value).trim()
}

export function classifyMemberImport(parsed, { students = [] } = {}) {
  const errors = [...(parsed.errors || [])]
  const warnings = [...(parsed.warnings || [])]
  const byEmail = new Map()
  const byIdentity = new Map()
  for (const existing of students) {
    const email = normalizeEmail(existing.email)
    if (email) byEmail.set(email, existing)
    const identity = buildStudentIdentityKey(existing)
    if (identity) byIdentity.set(identity, [...(byIdentity.get(identity) || []), existing])
  }

  const seenEmails = new Map()
  const seenIdentities = new Map()
  const studentResolutions = []
  let newStudents = 0
  let updatedStudents = 0
  for (const row of parsed.rows || []) {
    const profile = row.student || {}
    const email = normalizeEmail(profile.email)
    const identity = buildStudentIdentityKey(profile)
    let blocked = false
    if (email && seenEmails.has(email)) { errors.push({ row: row.source_row, field: '電子郵件地址', message: 'DUPLICATE_EMAIL' }); blocked = true } else if (email) seenEmails.set(email, row.source_row)
    if (identity && seenIdentities.has(identity)) { errors.push({ row: row.source_row, field: '識別資料', message: 'DUPLICATE_IDENTITY' }); blocked = true } else if (identity) seenIdentities.set(identity, row.source_row)
    const emailMatch = email ? byEmail.get(email) : null
    const identityMatches = identity ? (byIdentity.get(identity) || []) : []
    if (identityMatches.length > 1) { errors.push({ row: row.source_row, field: '識別資料', message: 'AMBIGUOUS_IDENTITY' }); blocked = true }
    const identityMatch = identityMatches[0] || null
    if (emailMatch && identityMatch && emailMatch.student_id !== identityMatch.student_id) { errors.push({ row: row.source_row, field: '識別資料', message: 'IDENTITY_CONFLICT' }); blocked = true }
    if (!email && !identity) warnings.push({ row: row.source_row, field: '識別資料', message: '缺少電子郵件及完整姓名、電話、出生年月日，將新增會員' })
    if (blocked) continue
    const match = emailMatch || identityMatch
    if (!match) { newStudents += 1; studentResolutions.push({ sourceRow: row.source_row, studentName: profile.name, action: 'insert', studentId: null, matchedBy: null, changedFields: [] }); continue }
    updatedStudents += 1
    const changedFields = Object.keys(MEMBER_FIELD_LABELS).filter(field => {
      const incoming = normalizeComparable(field, profile[field])
      return incoming !== null && incoming !== normalizeComparable(field, match[field])
    }).map(field => MEMBER_FIELD_LABELS[field])
    studentResolutions.push({ sourceRow: row.source_row, studentName: profile.name, action: 'update', studentId: match.student_id, matchedBy: emailMatch ? '電子郵件' : '姓名、電話、出生年月日', changedFields })
  }
  return { payload: { rows: (parsed.rows || []).map(row => ({ source_row: row.source_row, student: row.student })) }, summary: { fileRows: (parsed.rows || []).length, newStudents, updatedStudents, currentStudents: students.length }, studentResolutions, warnings, errors, hasBlockingErrors: errors.length > 0 }
}

export async function loadMemberImportPreview(client, parsed) {
  const { data, error } = await client.from('students').select('*').order('student_id')
  if (error) throw error
  return classifyMemberImport(parsed, { students: data || [] })
}
