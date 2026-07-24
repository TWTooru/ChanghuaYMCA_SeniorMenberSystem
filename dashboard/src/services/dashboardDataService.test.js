import { describe, expect, it } from 'vitest'
import { fetchDashboardData } from './dashboardDataService'

function createReadClient(results) {
  return {
    from(table) {
      return {
        select() {
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
            courses: [{ course_name: '肌力訓練' }, { course_name: '北歐健走' }]
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
    })

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
          courses: ['肌力訓練', '北歐健走']
        },
        {
          enrollment_id: 11,
          student_id: '3',
          season: '第十五季',
          refunded: true,
          student_name: '未知',
          courses: []
        }
      ]
    })
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
