import { describe, expect, it } from 'vitest'
import { fetchDashboardData } from './dashboardDataService'

function createReadClient(results, selectExpressions = {}, queryCalls = []) {
  return {
    from(table) {
      return {
        select(expression) {
          selectExpressions[table] = expression
          return {
            limit(limit) {
              const result = results[table]
              return Promise.resolve({ ...result, data: result.data?.slice(0, limit) || result.data })
            },
            order(column) {
              return {
                range(from, to) {
                  queryCalls.push({ table, column, from, to })
                  const result = results[table]
                  return Promise.resolve({ ...result, data: result.data?.slice(from, to + 1) || result.data })
                },
              }
            },
          }
        },
      }
    },
  }
}

describe('fetchDashboardData', () => {
  it('formats nested enrollments with grouped receipt billing and course names', async () => {
    const selectExpressions = {}
    const result = await fetchDashboardData(createReadClient({
      students: { data: [{ student_id: '1', name: 'Student One' }], error: null },
      enrollments: { data: [{
        enrollment_id: 10,
        student_id: '1',
        period: '第15期',
        refunded: 0,
        courses: [
          {
            course_id: 21,
            course_name: 'Course A',
            billing_receipt_courses: [{
              billing_receipts: { receipt_id: 31, amount: 1200, invoice_number: 'AB12345678' },
            }],
          },
          { course_id: 22, course_name: 'Course B', billing_receipt_courses: [] },
        ],
      }], error: null },
    }, selectExpressions))

    expect(result).toEqual({
      students: [{ student_id: '1', name: 'Student One' }],
      enrollments: [{
        enrollment_id: 10,
        student_id: '1',
        period: '第15期',
        refunded: false,
        student_name: 'Student One',
        courseDetails: [
          {
            courseId: 21,
            courseName: 'Course A',
            billingReceiptId: 31,
            receipt: { receiptId: 31, amount: 1200, invoiceNumber: 'AB12345678' },
          },
          { courseId: 22, courseName: 'Course B', billingReceiptId: null, receipt: null },
        ],
        billingReceipts: [{
          receiptId: 31,
          amount: 1200,
          invoiceNumber: 'AB12345678',
          courses: [{ courseId: 21, courseName: 'Course A' }],
        }],
        courses: ['Course A', 'Course B'],
      }],
    })
    expect(selectExpressions.enrollments).toBe('*, courses(*, billing_receipt_courses(*, billing_receipts(*)))')
  })

  it('keeps a shared receipt as one billing header with all linked courses', async () => {
    const result = await fetchDashboardData(createReadClient({
      students: { data: [{ student_id: '1', name: 'Student One' }], error: null },
      enrollments: { data: [{
        enrollment_id: 10,
        student_id: '1',
        refunded: 0,
        courses: [
          { course_id: 21, course_name: 'A', billing_receipt_courses: [{ billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' } }] },
          { course_id: 22, course_name: 'B', billing_receipt_courses: [{ billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' } }] },
        ],
      }], error: null },
    }))

    expect(result.enrollments[0].billingReceipts).toEqual([{
      receiptId: 100,
      amount: 3000,
      invoiceNumber: 'R-1',
      courses: [
        { courseId: 21, courseName: 'A' },
        { courseId: 22, courseName: 'B' },
      ],
    }])
  })

  it('loads every dashboard record across API result pages', async () => {
    const students = Array.from({ length: 1001 }, (_, index) => ({ student_id: String(index + 1), name: `Student ${index + 1}` }))
    const enrollments = Array.from({ length: 1001 }, (_, index) => ({ enrollment_id: `enrollment-${index + 1}`, student_id: String(index + 1), refunded: 0, courses: [] }))
    const queryCalls = []

    const result = await fetchDashboardData(createReadClient({
      students: { data: students, error: null },
      enrollments: { data: enrollments, error: null },
    }, {}, queryCalls))

    expect(result.students).toHaveLength(1001)
    expect(result.enrollments).toHaveLength(1001)
    expect(queryCalls).toEqual(expect.arrayContaining([
      { table: 'students', column: 'student_id', from: 0, to: 499 },
      { table: 'students', column: 'student_id', from: 500, to: 999 },
      { table: 'students', column: 'student_id', from: 1000, to: 1499 },
      { table: 'enrollments', column: 'enrollment_id', from: 0, to: 499 },
      { table: 'enrollments', column: 'enrollment_id', from: 500, to: 999 },
      { table: 'enrollments', column: 'enrollment_id', from: 1000, to: 1499 },
    ]))
  })

  it('loads every dashboard record across API result pages', async () => {
    const students = Array.from({ length: 1001 }, (_, index) => ({
      student_id: String(index + 1),
      name: `學員 ${index + 1}`,
    }))
    const enrollments = Array.from({ length: 1001 }, (_, index) => ({
      enrollment_id: `enrollment-${index + 1}`,
      student_id: String(index + 1),
      period: '第16期',
      refunded: 0,
      courses: [],
    }))
    const queryCalls = []

    const result = await fetchDashboardData(createReadClient({
      students: { data: students, error: null },
      enrollments: { data: enrollments, error: null },
    }, {}, queryCalls))

    expect(result.students).toHaveLength(1001)
    expect(result.enrollments).toHaveLength(1001)
    expect(result.enrollments.at(-1)).toMatchObject({
      enrollment_id: 'enrollment-1001',
      student_name: '學員 1001',
    })
    expect(queryCalls).toEqual(expect.arrayContaining([
      { table: 'students', column: 'student_id', from: 0, to: 499 },
      { table: 'students', column: 'student_id', from: 500, to: 999 },
      { table: 'students', column: 'student_id', from: 1000, to: 1499 },
      { table: 'enrollments', column: 'enrollment_id', from: 0, to: 499 },
      { table: 'enrollments', column: 'enrollment_id', from: 500, to: 999 },
      { table: 'enrollments', column: 'enrollment_id', from: 1000, to: 1499 },
    ]))
  })

  it('throws the Supabase error when the students query fails', async () => {
    const error = new Error('RLS denied')
    const client = createReadClient({
      students: { data: null, error },
      enrollments: { data: [], error: null },
    })

    await expect(fetchDashboardData(client)).rejects.toThrow('RLS denied')
  })
})
