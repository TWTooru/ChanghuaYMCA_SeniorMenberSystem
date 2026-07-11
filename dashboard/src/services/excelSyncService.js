import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabaseClient'
import { cleanCourseName, cleanDate, cleanInt, cleanScore, cleanStr, extractSeasonNum, validateWorkbookForImport } from '../domain/excelImport'

const STUDENT_KEYS = ['student_id', 'original_id', 'name', 'gender', 'birth_date', 'age', 'is_60_plus', 'address', 'home_phone', 'mobile_phone', 'emergency_contact', 'relationship', 'emergency_contact_phone', 'education', 'occupation']

export async function runSync(file) {
  const errors = []
  const { data: { session }, error: sessionError } = await supabase.auth.getSession()
  if (!session || sessionError) throw new Error('權限不足：請先登入後再執行同步操作 (Authentication failed).')

  validateWorkbookForImport({ fileSize: file.size, workbook: { SheetNames: [], Sheets: {} } })
  const data = await file.arrayBuffer()
  const workbook = XLSX.read(data, { type: 'array' })
  validateWorkbookForImport({ fileSize: file.size, workbook, getRows: sheet => XLSX.utils.sheet_to_json(sheet, { defval: null }) })

  const seasonSheets = workbook.SheetNames.filter(sheet => (sheet.includes('季') || sheet.includes('期')) && !sheet.includes('退費'))
  for (const sheetName of seasonSheets) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null })
    if (rows.length === 0) continue

    const columns = Object.keys(rows[0])
    const preTestCol = columns.find(column => column.includes('前測'))
    const postTestCol = columns.find(column => column.includes('後測'))
    const regTypeCol = columns.find(column => column.includes('新/續') || column.includes('新、續'))
    const courseCols = columns.filter(column => column.includes('課程'))
    const idCol = columns.find(column => column === '學員編號' || column === 'Unnamed: 0')
    const nameCol = columns.find(column => column === '姓名')
    const studentsMap = new Map()
    const enrollmentsMap = new Map()
    const coursesMap = new Map()

    for (const row of rows) {
      const name = nameCol ? cleanStr(row[nameCol]) : null
      if (!name || name === 'None' || !idCol || row[idCol] === null || row[idCol] === undefined) continue
      const rawId = parseInt(row[idCol], 10)
      if (Number.isNaN(rawId)) continue
      const studentId = String(rawId)
      studentsMap.set(studentId, {
        student_id: studentId, original_id: cleanStr(row['原始編號']), name, gender: cleanStr(row['性別']),
        birth_date: cleanDate(row['出生日期']), age: cleanInt(row['目前年齡']), is_60_plus: cleanStr(row['是否60歲']),
        address: cleanStr(row['地址']), home_phone: cleanStr(row['家裡電話']), mobile_phone: cleanStr(row['手機電話']),
        emergency_contact: cleanStr(row['主要聯絡人']), relationship: cleanStr(row['關係']),
        emergency_contact_phone: cleanStr(row['聯絡人電話']), education: cleanStr(row['教育程度']), occupation: cleanStr(row['職業'])
      })
      enrollmentsMap.set(studentId, {
        regType: regTypeCol ? cleanStr(row[regTypeCol]) : null,
        preTest: preTestCol ? cleanScore(row[preTestCol]) : null,
        postTest: postTestCol ? cleanScore(row[postTestCol]) : null
      })
      coursesMap.set(studentId, courseCols.map(column => cleanCourseName(row[column])).filter(Boolean))
    }

    const studentIds = Array.from(studentsMap.keys())
    if (studentIds.length === 0) continue
    const existingStudentsMap = new Map()
    for (let index = 0; index < studentIds.length; index += 500) {
      const { data: existingStudents, error } = await supabase.from('students').select('*').in('student_id', studentIds.slice(index, index + 500))
      if (error) errors.push(`[${sheetName}] Error fetching existing students: ${error.message}`)
      else existingStudents?.forEach(student => existingStudentsMap.set(student.student_id, student))
    }

    const mergedStudents = studentIds.map(studentId => {
      const imported = studentsMap.get(studentId)
      const existing = existingStudentsMap.get(studentId) || {}
      return STUDENT_KEYS.reduce((student, key) => {
        student[key] = imported[key] !== null && imported[key] !== undefined ? imported[key] : (existing[key] ?? null)
        return student
      }, {})
    })
    const failedStudentIds = new Set()
    for (let index = 0; index < mergedStudents.length; index += 500) {
      const chunk = mergedStudents.slice(index, index + 500)
      const { error } = await supabase.from('students').upsert(chunk, { onConflict: 'student_id' })
      if (error) {
        errors.push(`[${sheetName}] Students Upsert Error: ${error.message}`)
        chunk.forEach(student => failedStudentIds.add(student.student_id))
      }
    }

    const { data: existingEnrollments, error: enrollmentFetchError } = await supabase.from('enrollments').select('enrollment_id, student_id').eq('season', sheetName)
    if (enrollmentFetchError) {
      errors.push(`[${sheetName}] Enrollments Fetch Error: ${enrollmentFetchError.message}`)
      continue
    }
    const existingEnrollmentMap = new Map(existingEnrollments?.map(enrollment => [String(enrollment.student_id), enrollment.enrollment_id]))
    const enrollmentsToUpdate = []
    const enrollmentsToInsert = []
    for (const [studentId, enrollment] of enrollmentsMap) {
      if (failedStudentIds.has(studentId)) continue
      if (existingEnrollmentMap.has(studentId)) {
        const update = { enrollment_id: existingEnrollmentMap.get(studentId) }
        if (enrollment.regType !== null) update.reg_type = enrollment.regType
        if (enrollment.preTest !== null) update.pre_test = enrollment.preTest
        if (enrollment.postTest !== null) update.post_test = enrollment.postTest
        if (Object.keys(update).length > 1) enrollmentsToUpdate.push(update)
      } else {
        enrollmentsToInsert.push({ student_id: studentId, season: sheetName, reg_type: enrollment.regType, pre_test: enrollment.preTest, post_test: enrollment.postTest, refunded: 0 })
      }
    }
    for (let index = 0; index < enrollmentsToUpdate.length; index += 500) {
      const { error } = await supabase.from('enrollments').upsert(enrollmentsToUpdate.slice(index, index + 500))
      if (error) errors.push(`[${sheetName}] Enrollments Update Error: ${error.message}`)
    }
    let insertedEnrollments = []
    for (let index = 0; index < enrollmentsToInsert.length; index += 500) {
      const { data: inserted, error } = await supabase.from('enrollments').insert(enrollmentsToInsert.slice(index, index + 500)).select('enrollment_id, student_id')
      if (error) errors.push(`[${sheetName}] Enrollments Insert Error: ${error.message}`)
      else if (inserted) insertedEnrollments = insertedEnrollments.concat(inserted)
    }
    insertedEnrollments.forEach(enrollment => existingEnrollmentMap.set(String(enrollment.student_id), enrollment.enrollment_id))

    const enrollmentIds = []
    const coursesToInsert = []
    for (const [studentId, courses] of coursesMap) {
      const enrollmentId = existingEnrollmentMap.get(studentId)
      if (!enrollmentId) continue
      enrollmentIds.push(enrollmentId)
      courses.forEach(course_name => coursesToInsert.push({ enrollment_id: enrollmentId, course_name }))
    }
    for (let index = 0; index < enrollmentIds.length; index += 200) {
      const { error } = await supabase.from('courses').delete().in('enrollment_id', enrollmentIds.slice(index, index + 200))
      if (error) errors.push(`[${sheetName}] Courses Delete Error: ${error.message}`)
    }
    for (let index = 0; index < coursesToInsert.length; index += 500) {
      const { error } = await supabase.from('courses').insert(coursesToInsert.slice(index, index + 500))
      if (error) errors.push(`[${sheetName}] Courses Insert Error: ${error.message}`)
    }
  }

  const refundSheets = workbook.SheetNames.filter(sheet => sheet.includes('退費'))
  for (const refundSheet of refundSheets) {
    const refundNumber = extractSeasonNum(refundSheet)
    const targetSeason = seasonSheets.find(season => refundNumber !== -1 && extractSeasonNum(season) === refundNumber)
    if (!targetSeason) continue
    const namesToSearch = []
    const validStudentIds = []
    for (const row of XLSX.utils.sheet_to_json(workbook.Sheets[refundSheet], { defval: null })) {
      const name = cleanStr(row['姓名'])
      if (!name || name === 'None') continue
      const idColumn = row['學員編號'] !== undefined ? '學員編號' : (row['Unnamed: 0'] !== undefined ? 'Unnamed: 0' : null)
      const rawId = idColumn ? parseInt(row[idColumn], 10) : NaN
      if (Number.isNaN(rawId)) namesToSearch.push(name)
      else validStudentIds.push(String(rawId))
    }
    const nameToStudentId = new Map()
    for (let index = 0; index < namesToSearch.length; index += 100) {
      const { data: students, error } = await supabase.from('students').select('student_id, name').in('name', namesToSearch.slice(index, index + 100))
      if (error) errors.push(`[${refundSheet}] Refund Student Fetch Error: ${error.message}`)
      else students?.forEach(student => { if (!nameToStudentId.has(student.name)) nameToStudentId.set(student.name, student.student_id) })
    }
    const studentsToRefund = validStudentIds.concat(namesToSearch.map(name => nameToStudentId.get(name)).filter(Boolean))
    for (let index = 0; index < studentsToRefund.length; index += 200) {
      const { error } = await supabase.from('enrollments').update({ refunded: 1 }).eq('season', targetSeason).in('student_id', studentsToRefund.slice(index, index + 200))
      if (error) errors.push(`[${refundSheet}] Refund Update Error: ${error.message}`)
    }
  }

  return { errors }
}
