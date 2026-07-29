import { normalizeCourseDetails } from '../domain/enrollmentBilling'

/**
 * 讀取 `students` 與巢狀的 `enrollments → courses → course_receipts`，
 * 轉換為儀表板可直接使用的 `{ students, enrollments }` 快照；補齊學員名稱、
 * 正規化課程／收據明細，並將退款旗標轉為布林值。
 */
export async function fetchDashboardData(client) {
  const { data: studentsData, error: studentsError } = await client
    .from('students')
    .select('*')
    .limit(9999)

  if (studentsError) throw studentsError

  const { data: enrollmentsData, error: enrollmentsError } = await client
    .from('enrollments')
    .select('*, courses(*, course_receipts(*))')
    .limit(9999)

  if (enrollmentsError) throw enrollmentsError

  const students = studentsData || []
  const enrollments = enrollmentsData || []
  const studentMap = new Map(students.map(student => [String(student.student_id), student.name]))

  return {
    students,
    enrollments: enrollments.map(enrollment => {
      const courseDetails = normalizeCourseDetails(enrollment.courses)

      return {
        ...enrollment,
        student_name: studentMap.get(String(enrollment.student_id)) || '未知',
        courseDetails,
        courses: courseDetails.map(course => course.courseName),
        refunded: Boolean(enrollment.refunded)
      }
    })
  }
}
