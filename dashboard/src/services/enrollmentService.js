export function normalizeSelectedCourseNames(courses = []) {
  return [...new Set(
    (Array.isArray(courses) ? courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean)
  )]
}

export async function createEnrollmentWithCourses(client, studentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const enrollmentData = {
    season,
    reg_type,
    pre_test,
    post_test,
    refunded: refunded ? 1 : 0,
    refund_info,
    student_id: studentId
  }

  const { data: insertedEnrollment, error } = await client
    .from('enrollments')
    .insert([enrollmentData])
    .select()
    .single()

  if (error) throw error

  const courseList = normalizeSelectedCourseNames(courses)
  if (courseList.length === 0) return insertedEnrollment

  const courseData = courseList.map(courseName => ({
    enrollment_id: insertedEnrollment.enrollment_id,
    course_name: courseName
  }))

  const { error: courseError } = await client.from('courses').insert(courseData)
  if (!courseError) return insertedEnrollment

  const { error: rollbackError } = await client
    .from('enrollments')
    .delete()
    .eq('enrollment_id', insertedEnrollment.enrollment_id)

  if (rollbackError) {
    throw new Error(`course insert failed and rollback failed: ${rollbackError.message}. Original error: ${courseError.message}`)
  }

  throw new Error(`課程新增失敗，已取消此選課紀錄。(${courseError.message})`)
}

export async function updateEnrollmentWithCourses(client, enrollmentId, form) {
  const { season, reg_type, pre_test, post_test, refunded, refund_info, courses } = form
  const courseNames = normalizeSelectedCourseNames(courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const { error } = await client.rpc('update_enrollment_with_courses', {
    p_enrollment_id: enrollmentId,
    p_season: season,
    p_reg_type: reg_type,
    p_pre_test: pre_test,
    p_post_test: post_test,
    p_refunded: refunded ? 1 : 0,
    p_refund_info: refund_info,
    p_course_names: courseNames,
  })

  if (!error) return

  const mappedMessage = {
    COURSE_RECEIPT_LOCKED: '已有收據的課程不能移除',
    COURSE_REQUIRED: '請至少選擇一門課程',
  }[error.message]
  throw new Error(mappedMessage || error.message)
}

export async function deleteEnrollment(client, enrollmentId) {
  const { error } = await client.from('enrollments').delete().eq('enrollment_id', enrollmentId)
  if (error) throw error
}

