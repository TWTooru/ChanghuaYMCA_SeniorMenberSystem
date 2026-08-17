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

  it('collects multiple receipts when a course has multiple billing_receipt_courses links', () => {
    expect(normalizeEnrollmentBilling([
      {
        course_id: 20,
        course_name: '瑜珈課',
        billing_receipt_courses: [
          {
            billing_receipts: { receipt_id: 200, amount: 500, invoice_number: 'P-1' },
          },
          {
            billing_receipts: { receipt_id: 201, amount: 2800, invoice_number: 'F-1' },
          },
        ],
      },
      {
        course_id: 21,
        course_name: '手機課',
        billing_receipt_courses: [
          {
            billing_receipts: { receipt_id: 200, amount: 500, invoice_number: 'P-1' },
          },
          {
            billing_receipts: { receipt_id: 201, amount: 2800, invoice_number: 'F-1' },
          },
        ],
      },
    ])).toEqual({
      courseDetails: [
        {
          courseId: 20,
          courseName: '瑜珈課',
          billingReceiptId: 200,
          receipt: { receiptId: 200, amount: 500, invoiceNumber: 'P-1' },
        },
        {
          courseId: 21,
          courseName: '手機課',
          billingReceiptId: 200,
          receipt: { receiptId: 200, amount: 500, invoiceNumber: 'P-1' },
        },
      ],
      billingReceipts: [
        {
          receiptId: 200,
          amount: 500,
          invoiceNumber: 'P-1',
          courses: [
            { courseId: 20, courseName: '瑜珈課' },
            { courseId: 21, courseName: '手機課' },
          ],
        },
        {
          receiptId: 201,
          amount: 2800,
          invoiceNumber: 'F-1',
          courses: [
            { courseId: 20, courseName: '瑜珈課' },
            { courseId: 21, courseName: '手機課' },
          ],
        },
      ],
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
