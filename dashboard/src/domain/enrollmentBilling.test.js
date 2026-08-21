import { describe, expect, it } from 'vitest'
import { normalizeCourseDetails, normalizeEnrollmentBilling, summarizeEnrollmentBilling } from './enrollmentBilling'

describe('normalizeCourseDetails', () => {
  it('normalizes nested Supabase receipt arrays while preserving stable course IDs', () => {
    expect(normalizeCourseDetails([
      {
        course_id: 7,
        course_name: '??閮毀',
        course_receipts: [{ receipt_id: 9, amount: 1200, invoice_number: 'A-1' }],
      },
      { course_id: 8, course_name: '???亥粥', course_receipts: [] },
    ])).toEqual([
      {
        courseId: 7,
        courseName: '??閮毀',
        receipt: { receiptId: 9, amount: 1200, invoiceNumber: 'A-1' },
      },
      { courseId: 8, courseName: '???亥粥', receipt: null },
    ])
  })
})

describe('normalizeEnrollmentBilling', () => {
  it('keeps every linked receipt while exposing the first receipt on a course detail', () => {
    const result = normalizeEnrollmentBilling([{
      course_id: 1,
      course_name: 'Course A',
      billing_receipt_courses: [
        { billing_receipts: { receipt_id: 10, amount: 500, invoice_number: 'R-10' } },
        { billing_receipts: { receipt_id: 11, amount: 700, invoice_number: 'R-11' } },
      ],
    }])

    expect(result.billingReceipts.map(receipt => receipt.receiptId)).toEqual([10, 11])
    expect(result.courseDetails[0].receipt.receiptId).toBe(10)
  })

  it('deduplicates one grouped receipt linked to multiple courses', () => {
    const result = normalizeEnrollmentBilling([
      {
        course_id: 1,
        course_name: 'Course A',
        billing_receipt_courses: { billing_receipts: { receipt_id: 20, amount: 500, invoice_number: 'R-20' } },
      },
      {
        course_id: 2,
        course_name: 'Course B',
        billing_receipt_courses: [{ billing_receipts: [{ receipt_id: 20, amount: 500, invoice_number: 'R-20' }] }],
      },
    ])

    expect(result.billingReceipts).toHaveLength(1)
    expect(result.billingReceipts[0].courses).toHaveLength(2)
  })

  it('groups a shared billing receipt once while retaining every linked course', () => {
    expect(normalizeEnrollmentBilling([
      {
        course_id: 10,
        course_name: 'A',
        billing_receipt_courses: [{
          billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' },
        }],
      },
      {
        course_id: 11,
        course_name: 'B',
        billing_receipt_courses: [{
          billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' },
        }],
      },
      { course_id: 12, course_name: 'C', billing_receipt_courses: [] },
    ])).toEqual({
      courseDetails: [
        {
          courseId: 10,
          courseName: 'A',
          billingReceiptId: 100,
          receipt: { receiptId: 100, amount: 3000, invoiceNumber: 'R-1' },
        },
        {
          courseId: 11,
          courseName: 'B',
          billingReceiptId: 100,
          receipt: { receiptId: 100, amount: 3000, invoiceNumber: 'R-1' },
        },
        { courseId: 12, courseName: 'C', billingReceiptId: null, receipt: null },
      ],
      billingReceipts: [{
        receiptId: 100,
        amount: 3000,
        invoiceNumber: 'R-1',
        courses: [
          { courseId: 10, courseName: 'A' },
          { courseId: 11, courseName: 'B' },
        ],
      }],
    })
  })
})

describe('summarizeEnrollmentBilling', () => {
  it('counts a shared receipt only once from grouped receipts', () => {
    expect(summarizeEnrollmentBilling({
      billingReceipts: [{ receiptId: 100, amount: 3000, invoiceNumber: 'R-1', courses: [] }],
    })).toEqual({ amount: 3000, invoiceNumbers: ['R-1'], source: 'receipts' })
  })
  it('sums non-null receipt amounts and deduplicates non-blank invoice numbers', () => {
    expect(summarizeEnrollmentBilling({
      amount: 9999,
      invoice_number: 'LEGACY',
      courseDetails: [
        { receipt: { amount: 0, invoiceNumber: ' R-1 ' } },
        { receipt: { amount: 1200, invoiceNumber: 'R-1' } },
        { receipt: { amount: null, invoiceNumber: 'R-2' } },
      ],
    })).toEqual({ amount: 1200, invoiceNumbers: ['R-1', 'R-2'], source: 'receipts' })
  })

  it('falls back to legacy billing only when no receipt row exists', () => {
    expect(summarizeEnrollmentBilling({
      amount: 2400,
      invoice_number: ' LEGACY-1 ',
      courseDetails: [{ receipt: null }],
    })).toEqual({ amount: 2400, invoiceNumbers: ['LEGACY-1'], source: 'legacy' })
  })

  it('does not turn all-null receipt amounts into zero', () => {
    expect(summarizeEnrollmentBilling({
      amount: 2400,
      invoice_number: 'LEGACY',
      courseDetails: [{ receipt: { amount: null, invoiceNumber: null } }],
    })).toEqual({ amount: null, invoiceNumbers: [], source: 'receipts' })
  })
})
