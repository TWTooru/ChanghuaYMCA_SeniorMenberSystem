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
  it('formats nested enrollments with enrollment_forms, receipts and courses', async () => {
    const selectExpressions = {}
    const result = await fetchDashboardData(createReadClient({
      students: { data: [{ student_id: '1', name: 'Student One' }], error: null },
      enrollments: { data: [{
        enrollment_id: 10,
        student_id: '1',
        period: '第15期',
        enrollment_forms: [
          {
            form_id: 101,
            form_sequence: 1,
            refunded: false,
            courses: [
              { course_id: 21, course_name: 'Course A' },
              { course_id: 22, course_name: 'Course B' },
            ],
            billing_receipts: [
              { receipt_id: 31, receipt_kind: 'formal', amount: 1200, invoice_number: 'AB12345678' },
            ],
          },
        ],
      }], error: null },
    }, selectExpressions))

    expect(result).toEqual({
      students: [{ student_id: '1', name: 'Student One' }],
      enrollments: [{
        enrollment_id: 10,
        student_id: '1',
        period: '第15期',
        student_name: 'Student One',
        enrollment_forms: [
          {
            form_id: 101,
            form_sequence: 1,
            refunded: false,
            courses: [
              { course_id: 21, course_name: 'Course A' },
              { course_id: 22, course_name: 'Course B' },
            ],
            billing_receipts: [
              { receipt_id: 31, receipt_kind: 'formal', amount: 1200, invoice_number: 'AB12345678' },
            ],
          },
        ],
        forms: [
          expect.objectContaining({
            form_id: 101,
            form_sequence: 1,
            refunded: false,
            courses: ['Course A', 'Course B'],
            courseDetails: [
              { courseId: 21, courseName: 'Course A' },
              { courseId: 22, courseName: 'Course B' },
            ],
            billingReceipts: [
              { receiptId: 31, receiptKind: 'formal', amount: 1200, invoiceNumber: 'AB12345678' },
            ],
          }),
        ],
        formCount: 1,
        refundStatus: 'normal',
        refunded: false,
        courseDetails: [
          { courseId: 21, courseName: 'Course A' },
          { courseId: 22, courseName: 'Course B' },
        ],
        billingReceipts: [
          { receiptId: 31, receiptKind: 'formal', amount: 1200, invoiceNumber: 'AB12345678' },
        ],
        courses: ['Course A', 'Course B'],
      }],
    })
    expect(selectExpressions.enrollments).toBe('*, enrollment_forms(*, courses(*), billing_receipts(*))')
  })

  it('keeps receipts associated with each form', async () => {
    const result = await fetchDashboardData(createReadClient({
      students: { data: [{ student_id: '1', name: 'Student One' }], error: null },
      enrollments: { data: [{
        enrollment_id: 10,
        student_id: '1',
        enrollment_forms: [
          {
            form_id: 101,
            form_sequence: 1,
            refunded: false,
            courses: [
              { course_id: 21, course_name: 'A' },
              { course_id: 22, course_name: 'B' },
            ],
            billing_receipts: [
              { receipt_id: 100, receipt_kind: 'formal', amount: 3000, invoice_number: 'R-1' },
            ],
          },
        ],
      }], error: null },
    }))

    expect(result.enrollments[0].billingReceipts).toEqual([{
      receiptId: 100,
      receiptKind: 'formal',
      amount: 3000,
      invoiceNumber: 'R-1',
    }])
  })

  it('loads every dashboard record across API result pages', async () => {
    const students = Array.from({ length: 1001 }, (_, index) => ({ student_id: String(index + 1), name: `Student ${index + 1}` }))
    const enrollments = Array.from({ length: 1001 }, (_, index) => ({ enrollment_id: `enrollment-${index + 1}`, student_id: String(index + 1), refunded: 0, enrollment_forms: [] }))
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

  it('throws the Supabase error when the students query fails', async () => {
    const error = new Error('RLS denied')
    const client = createReadClient({
      students: { data: null, error },
      enrollments: { data: [], error: null },
    })

    await expect(fetchDashboardData(client)).rejects.toThrow('RLS denied')
  })
})
