export async function fetchDashboardData(client) {
  const { data: studentsData, error: studentsError } = await client
    .from('students')
    .select('*')
    .limit(9999)

  if (studentsError) throw studentsError

  const { data: enrollmentsData, error: enrollmentsError } = await client
    .from('enrollments')
    .select('*, courses(*)')
    .limit(9999)

  if (enrollmentsError) throw enrollmentsError

  const students = studentsData || []
  const enrollments = enrollmentsData || []
  const studentMap = new Map(students.map(student => [String(student.student_id), student.name]))

  return {
    students,
    enrollments: enrollments.map(enrollment => ({
      ...enrollment,
      student_name: studentMap.get(String(enrollment.student_id)) || '未知',
      courses: Array.isArray(enrollment.courses)
        ? enrollment.courses.map(course => course.course_name)
        : [],
      refunded: Boolean(enrollment.refunded)
    }))
  }
}
