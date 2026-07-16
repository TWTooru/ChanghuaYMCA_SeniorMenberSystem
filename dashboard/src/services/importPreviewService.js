const normalizeName = value => String(value || '').trim().toLocaleLowerCase('zh-TW')
const normalizePhone = value => String(value || '').replace(/\D/g, '')
const enrollmentKey = value => `${String(value.student_id)}\u0000${value.season}`

function suspectedDuplicate(student, existing) {
  if (normalizeName(student.name) !== normalizeName(existing.name)) return false
  const sameBirth = student.birth_date && existing.birth_date === student.birth_date
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
  let oldStudents = 0
  let newStudents = 0
  let enrollmentsToInsert = 0
  let enrollmentsToUpdate = 0
  let courses = 0

  for (const row of parsed.rows) {
    const id = row.provided_student_id
    if (id) {
      if (seenIds.has(id)) errors.push({ row: row.source_row, field: '學員編號', message: `檔案內重複編號 ${id}` })
      seenIds.add(id)
      const exists = studentsById.has(id)
      if (!exists && parsed.mode !== 'legacy-total') errors.push({ row: row.source_row, field: '學員編號', message: `資料庫找不到編號 ${id}` })
      if (exists) oldStudents += 1
      else newStudents += 1
    } else {
      const duplicate = snapshot.students.find(student => suspectedDuplicate(row.student, student))
      if (duplicate) errors.push({ row: row.source_row, field: '學員編號', message: `疑似既有學生，請填入編號 ${duplicate.student_id}` })
      newStudents += 1
    }
    for (const enrollment of row.enrollments) {
      const key = id ? `${id}\u0000${enrollment.season}` : null
      if (key && existingEnrollmentKeys.has(key)) enrollmentsToUpdate += 1
      else enrollmentsToInsert += 1
      courses += enrollment.courses.length
    }
  }

  const tableCounts = snapshot.tableCounts
  if (tableCounts.students || tableCounts.enrollments || tableCounts.courses) {
    warnings.push({ row: null, field: '資料庫', message: 'Supabase 目前不是空資料庫，請確認新增與更新筆數' })
  }
  const importedSeasons = new Set(parsed.rows.flatMap(row => row.enrollments.map(enrollment => enrollment.season)))
  const hasExistingTargetSeason = snapshot.enrollments.some(enrollment => importedSeasons.has(enrollment.season))
  if (hasExistingTargetSeason) warnings.push({ row: null, field: '報名', message: '目標季度已有資料，本次會更新並取代課程' })
  return {
    ...parsed,
    payload: { mode: parsed.mode, rows: parsed.rows },
    summary: {
      fileRows: parsed.rows.length, oldStudents, newStudents,
      enrollmentsToInsert, enrollmentsToUpdate, courses,
      currentStudents: tableCounts.students,
      currentEnrollments: tableCounts.enrollments,
      currentCourses: tableCounts.courses
    },
    warnings, errors, hasBlockingErrors: errors.length > 0
  }
}

export async function loadImportPreview(client, parsed) {
  const [studentsResult, enrollmentsResult, studentCount, enrollmentCount, courseCount] = await Promise.all([
    client.from('students').select('*').limit(9999),
    client.from('enrollments').select('student_id, season').limit(9999),
    client.from('students').select('*', { count: 'exact', head: true }),
    client.from('enrollments').select('*', { count: 'exact', head: true }),
    client.from('courses').select('*', { count: 'exact', head: true })
  ])

  const error = studentsResult.error || enrollmentsResult.error || studentCount.error || enrollmentCount.error || courseCount.error
  if (error) throw error

  return classifyImport(parsed, {
    students: studentsResult.data || [],
    enrollments: enrollmentsResult.data || [],
    tableCounts: {
      students: studentCount.count || 0,
      enrollments: enrollmentCount.count || 0,
      courses: courseCount.count || 0
    }
  })
}
