import { describe, expect, it } from 'vitest'
import { normalizeCourseDetails, summarizeEnrollmentBilling } from './enrollmentBilling'

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

describe('summarizeEnrollmentBilling', () => {
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
