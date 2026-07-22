import { splitCourseNames } from '../domain/studentFields'

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

  const courseList = splitCourseNames(courses)
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

export async function deleteEnrollment(client, enrollmentId) {
  const { error } = await client.from('enrollments').delete().eq('enrollment_id', enrollmentId)
  if (error) throw error
}

