import { buildStudentIdentityKey } from '../domain/studentIdentity'

const enrollmentKey = value => `${String(value.student_id)}\u0000${value.season}`
const SNAPSHOT_PAGE_SIZE = 1000

export function classifyImport(parsed, snapshot) {
  const errors = [...(parsed.errors || [])]
  const warnings = [...(parsed.warnings || [])]
  const addError = error => {
    if (!errors.some(existing => existing.row === error.row && existing.field === error.field && existing.message === error.message)) errors.push(error)
  }
  const studentsById = new Map(snapshot.students.map(student => [String(student.student_id), student]))
  const studentsByIdentity = new Map()
  for (const student of snapshot.students) {
    const key = buildStudentIdentityKey(student)
    if (key) studentsByIdentity.set(key, [...(studentsByIdentity.get(key) || []), student])
  }

  const existingEnrollmentKeys = new Set(snapshot.enrollments.map(enrollmentKey))
  const seenEffectiveIds = new Map()
  const seenBlankIdentities = new Map()
  const studentResolutions = []
  let oldStudents = 0, newStudents = 0, enrollmentsToInsert = 0, enrollmentsToUpdate = 0
  let courses = 0, preTestsCleared = 0, postTestsCleared = 0

  for (const row of parsed.rows) {
    const suppliedId = row.provided_student_id
    let effectiveId = suppliedId
    let valid = true
    if (suppliedId) {
      if (studentsById.has(suppliedId)) oldStudents += 1
      else newStudents += 1
    } else {
      const identityKey = buildStudentIdentityKey(row.student)
      const firstRow = identityKey ? seenBlankIdentities.get(identityKey) : null
      if (firstRow) {
        addError({ row: row.source_row, field: '學員編號', message: `疑似重複學生，請先核對來源第 ${firstRow} 列` })
        valid = false
      } else if (identityKey) {
        seenBlankIdentities.set(identityKey, row.source_row)
      }
      const matches = identityKey ? (studentsByIdentity.get(identityKey) || []) : []
      if (matches.length > 1) {
        addError({ row: row.source_row, field: '學員編號', message: '姓名、性別與出生日期對應多位學生，請先處理資料' })
        valid = false
      } else if (matches.length === 1) {
        effectiveId = String(matches[0].student_id)
        if (valid) {
          oldStudents += 1
          studentResolutions.push({ sourceRow: row.source_row, studentName: row.student.name, action: 'update', studentId: effectiveId })
        }
      } else if (valid) {
        newStudents += 1
        studentResolutions.push({ sourceRow: row.source_row, studentName: row.student.name, action: 'insert', studentId: null })
      }
    }
    if (valid && effectiveId) {
      const firstRow = seenEffectiveIds.get(effectiveId)
      if (firstRow) {
        addError({ row: row.source_row, field: '學員編號', message: `檔案內重複編號 ${effectiveId}` })
        valid = false
      } else seenEffectiveIds.set(effectiveId, row.source_row)
    }
    for (const enrollment of row.enrollments) {
      const key = valid && effectiveId ? `${effectiveId}\u0000${enrollment.season}` : null
      if (key && existingEnrollmentKeys.has(key)) enrollmentsToUpdate += 1
      else enrollmentsToInsert += 1
      courses += enrollment.courses.length
      if (enrollment.pre_test === null) preTestsCleared += 1
      if (enrollment.post_test === null) postTestsCleared += 1
    }
  }

  const tableCounts = snapshot.tableCounts
  if (tableCounts.students || tableCounts.enrollments || tableCounts.courses) warnings.push({ row: null, field: '資料庫', message: 'Supabase 資料庫已有資料，匯入前請再次確認內容' })
  const importedSeasons = new Set(parsed.rows.flatMap(row => row.enrollments.map(enrollment => enrollment.season)))
  if (snapshot.enrollments.some(enrollment => importedSeasons.has(enrollment.season))) warnings.push({ row: null, field: '報名', message: '目標季度已有資料，請確認新增、更新與課程取代筆數' })
  return {
    ...parsed,
    payload: { mode: parsed.mode, rows: parsed.rows },
    studentResolutions,
    summary: { fileRows: parsed.rows.length, oldStudents, newStudents, enrollmentsToInsert, enrollmentsToUpdate, courses, targetSeason: parsed.seasons?.[0] || null, preTestsCleared, postTestsCleared, currentStudents: tableCounts.students, currentEnrollments: tableCounts.enrollments, currentCourses: tableCounts.courses },
    warnings, errors, hasBlockingErrors: errors.length > 0,
  }
}

async function loadAllRows(client, table, columns, orderColumn) {
  const rows = []
  for (let from = 0; ; from += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await client.from(table).select(columns).order(orderColumn).range(from, from + SNAPSHOT_PAGE_SIZE - 1)
    if (error) throw error
    const page = data || []
    rows.push(...page)
    if (page.length < SNAPSHOT_PAGE_SIZE) return rows
  }
}

export async function loadImportPreview(client, parsed) {
  const [studentsResult, enrollmentsResult, studentCount, enrollmentCount, courseCount] = await Promise.all([
    loadAllRows(client, 'students', '*', 'student_id'), loadAllRows(client, 'enrollments', 'enrollment_id, student_id, season', 'enrollment_id'),
    client.from('students').select('*', { count: 'exact', head: true }), client.from('enrollments').select('*', { count: 'exact', head: true }), client.from('courses').select('*', { count: 'exact', head: true }),
  ])
  const error = studentCount.error || enrollmentCount.error || courseCount.error
  if (error) throw error
  return classifyImport(parsed, { students: studentsResult, enrollments: enrollmentsResult, tableCounts: { students: studentCount.count || 0, enrollments: enrollmentCount.count || 0, courses: courseCount.count || 0 } })
}
