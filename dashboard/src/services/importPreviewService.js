const normalizeName = value => String(value || '').trim().toLocaleLowerCase('zh-TW')
const normalizePhone = value => String(value || '').replace(/\D/g, '')
const normalizeStoredDate = value => {
  const match = String(value || '').trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  return match ? `${match[1]}/${match[2].padStart(2, '0')}/${match[3].padStart(2, '0')}` : ''
}
const enrollmentKey = value => `${String(value.student_id)}\u0000${value.season}`
const SNAPSHOT_PAGE_SIZE = 1000

function suspectedDuplicate(student, existing) {
  if (normalizeName(student.name) !== normalizeName(existing.name)) return false
  const birthDate = normalizeStoredDate(student.birth_date)
  const sameBirth = birthDate && birthDate === normalizeStoredDate(existing.birth_date)
  const phone = normalizePhone(student.mobile_phone)
  const samePhone = phone && phone === normalizePhone(existing.mobile_phone)
  return Boolean(sameBirth || samePhone)
}

export function classifyImport(parsed, snapshot) {
  const errors = [...(parsed.errors || [])]
  const warnings = [...(parsed.warnings || [])]
  const studentsById = new Map(snapshot.students.map(student => [String(student.student_id), student]))
  const existingEnrollmentKeys = new Set(snapshot.enrollments.map(enrollmentKey))
  const seenIds = new Set()
  const blankIdStudents = []
  let oldStudents = 0
  let newStudents = 0
  let enrollmentsToInsert = 0
  let enrollmentsToUpdate = 0
  let courses = 0
  let preTestsCleared = 0
  let postTestsCleared = 0

  for (const row of parsed.rows) {
    const id = row.provided_student_id
    if (id) {
      if (seenIds.has(id)) errors.push({ row: row.source_row, field: '學員編號', message: `檔案內重複編號 ${id}` })
      seenIds.add(id)
      const exists = studentsById.has(id)
      if (exists) oldStudents += 1
      else newStudents += 1
    } else {
      const existingDuplicate = snapshot.students.find(student => suspectedDuplicate(row.student, student))
      const importedDuplicate = blankIdStudents.find(previous => suspectedDuplicate(row.student, previous.student))
      if (existingDuplicate) errors.push({ row: row.source_row, field: '學員編號', message: `疑似既有學生，請填入編號 ${existingDuplicate.student_id}` })
      else if (importedDuplicate) errors.push({ row: row.source_row, field: '學員編號', message: `疑似重複學生，請先核對來源第 ${importedDuplicate.source_row} 列` })
      blankIdStudents.push(row)
      newStudents += 1
    }
    for (const enrollment of row.enrollments) {
      const key = id ? `${id}\u0000${enrollment.season}` : null
      if (key && existingEnrollmentKeys.has(key)) enrollmentsToUpdate += 1
      else enrollmentsToInsert += 1
      courses += enrollment.courses.length
      if (enrollment.pre_test === null) preTestsCleared += 1
      if (enrollment.post_test === null) postTestsCleared += 1
    }
  }

  const tableCounts = snapshot.tableCounts
  if (tableCounts.students || tableCounts.enrollments || tableCounts.courses) {
    warnings.push({ row: null, field: '資料庫', message: 'Supabase 目前不是空資料庫，請確認新增與更新筆數' })
  }
  const importedSeasons = new Set(parsed.rows.flatMap(row => row.enrollments.map(enrollment => enrollment.season)))
  const hasExistingTargetSeason = snapshot.enrollments.some(enrollment => importedSeasons.has(enrollment.season))
  if (hasExistingTargetSeason) warnings.push({ row: null, field: '報名', message: '目標季度已有資料，請確認新增、更新與課程取代筆數' })
  return {
    ...parsed,
    payload: { mode: parsed.mode, rows: parsed.rows },
    summary: {
      fileRows: parsed.rows.length, oldStudents, newStudents,
      enrollmentsToInsert, enrollmentsToUpdate, courses,
      targetSeason: parsed.seasons?.[0] || null,
      preTestsCleared,
      postTestsCleared,
      currentStudents: tableCounts.students,
      currentEnrollments: tableCounts.enrollments,
      currentCourses: tableCounts.courses
    },
    warnings, errors, hasBlockingErrors: errors.length > 0
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
    loadAllRows(client, 'students', '*', 'student_id'),
    loadAllRows(client, 'enrollments', 'enrollment_id, student_id, season', 'enrollment_id'),
    client.from('students').select('*', { count: 'exact', head: true }),
    client.from('enrollments').select('*', { count: 'exact', head: true }),
    client.from('courses').select('*', { count: 'exact', head: true })
  ])

  const error = studentCount.error || enrollmentCount.error || courseCount.error
  if (error) throw error

  return classifyImport(parsed, {
    students: studentsResult,
    enrollments: enrollmentsResult,
    tableCounts: {
      students: studentCount.count || 0,
      enrollments: enrollmentCount.count || 0,
      courses: courseCount.count || 0
    }
  })
}
