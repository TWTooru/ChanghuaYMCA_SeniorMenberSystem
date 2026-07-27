import { describe, expect, it } from 'vitest'
import { fetchDashboardData } from './dashboardDataService'

function createReadClient(results, selectExpressions = {}) {
  return {
    from(table) {
      return {
        select(expression) {
          selectExpressions[table] = expression
          return {
            limit: async () => results[table]
          }
        }
      }
    }
  }
}

describe('fetchDashboardData', () => {
  it('loads students and formats nested enrollments for the dashboard', async () => {
    const selectExpressions = {}
    const client = createReadClient({
      students: {
        data: [
          { student_id: '1', name: '王小明' },
          { student_id: '2', name: '李小華' }
        ],
        error: null
      },
      enrollments: {
        data: [
          {
            enrollment_id: 10,
            student_id: '1',
            season: '第十五季',
            refunded: 0,
            amount: 1200,
            invoice_number: 'AB12345678',
            courses: [
              {
                course_id: 21,
                course_name: '肌力訓練',
                course_receipts: [{ receipt_id: 31, amount: 1200, invoice_number: 'AB12345678' }]
              },
              { course_id: 22, course_name: '北歐健走', course_receipts: [] }
            ]
          },
          {
            enrollment_id: 11,
            student_id: '3',
            season: '第十五季',
            refunded: 1,
            courses: []
          }
        ],
        error: null
      }
    }, selectExpressions)

    await expect(fetchDashboardData(client)).resolves.toEqual({
      students: [
        { student_id: '1', name: '王小明' },
        { student_id: '2', name: '李小華' }
      ],
      enrollments: [
        {
          enrollment_id: 10,
          student_id: '1',
          season: '第十五季',
          refunded: false,
          amount: 1200,
          invoice_number: 'AB12345678',
          student_name: '王小明',
          courseDetails: [
            {
              courseId: 21,
              courseName: '肌力訓練',
              receipt: { receiptId: 31, amount: 1200, invoiceNumber: 'AB12345678' }
            },
            { courseId: 22, courseName: '北歐健走', receipt: null }
          ],
          courses: ['肌力訓練', '北歐健走']
        },
        {
          enrollment_id: 11,
          student_id: '3',
          season: '第十五季',
          refunded: true,
          student_name: '未知',
          courseDetails: [],
          courses: []
        }
      ]
    })
    expect(selectExpressions.enrollments).toBe('*, courses(*, course_receipts(*))')
  })

  it('throws the Supabase error when the students query fails', async () => {
    const error = new Error('RLS denied')
    const client = createReadClient({
      students: { data: null, error },
      enrollments: { data: [], error: null }
    })

    await expect(fetchDashboardData(client)).rejects.toThrow('RLS denied')
  })
})
