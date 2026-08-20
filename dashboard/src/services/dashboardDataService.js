import { normalizeEnrollmentForms, getEnrollmentRefundStatus } from '../domain/enrollmentForms'

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
 * 讀取 `students` 與巢狀的 `enrollments → enrollment_forms → courses / billing_receipts`，
 * 轉換為儀表板可直接使用的 `{ students, enrollments }` 快照；補齊學員名稱、
 * 正規化報名表、課程與收據明細，並計算退款狀態。
 */
export async function fetchDashboardData(client) {
  const [students, enrollments] = await Promise.all([
    loadAllRows(client, 'students', '*', 'student_id'),
    loadAllRows(client, 'enrollments', '*, enrollment_forms(*, courses(*), billing_receipts(*))', 'enrollment_id'),
  ])
  const studentMap = new Map(students.map(student => [String(student.student_id), student.name]))

  return {
    students,
    enrollments: enrollments.map(enrollment => {
      const forms = normalizeEnrollmentForms(enrollment.enrollment_forms)
      const refundStatus = getEnrollmentRefundStatus(forms)
      const courseDetails = forms.flatMap(f => f.courseDetails)
      const billingReceipts = forms.flatMap(f => f.billingReceipts)
      const courses = [...new Set(forms.flatMap(f => f.courses))]

      return {
        ...enrollment,
        student_name: studentMap.get(String(enrollment.student_id)) || '未知',
        forms,
        formCount: forms.length,
        refundStatus,
        refunded: refundStatus === 'refunded',
        courseDetails,
        billingReceipts,
        courses,
      }
    })
  }
}
