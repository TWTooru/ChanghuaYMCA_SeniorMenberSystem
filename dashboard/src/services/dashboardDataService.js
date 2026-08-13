import { normalizeEnrollmentBilling } from '../domain/enrollmentBilling'

const DASHBOARD_PAGE_SIZE = 500

async function loadAllRows(client, table, columns, orderColumn) {
  const rows = []
  let from = 0

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderColumn)
      .range(from, from + DASHBOARD_PAGE_SIZE - 1)

    if (error) throw error

    const page = data || []
    rows.push(...page)
    if (page.length === 0) return rows

    from += page.length
  }
}

/**
 * 讀取 `students` 與巢狀的 `enrollments → courses → billing_receipt_courses → billing_receipts`，
 * 轉換為儀表板可直接使用的 `{ students, enrollments }` 快照；補齊學員名稱、
 * 正規化課程／收據明細，並將退款旗標轉為布林值。
 */
export async function fetchDashboardData(client) {
  const [students, enrollments] = await Promise.all([
    loadAllRows(client, 'students', '*', 'student_id'),
    loadAllRows(client, 'enrollments', '*, courses(*, billing_receipt_courses(*, billing_receipts(*)))', 'enrollment_id'),
  ])
  const studentMap = new Map(students.map(student => [String(student.student_id), student.name]))

  return {
    students,
    enrollments: enrollments.map(enrollment => {
      const { courseDetails, billingReceipts } = normalizeEnrollmentBilling(enrollment.courses)

      return {
        ...enrollment,
        student_name: studentMap.get(String(enrollment.student_id)) || '未知',
        courseDetails,
        billingReceipts,
        courses: courseDetails.map(course => course.courseName),
        refunded: Boolean(enrollment.refunded)
      }
    })
  }
}
