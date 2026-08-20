import { describe, expect, it } from 'vitest'
import {
  normalizeEnrollmentForm,
  normalizeEnrollmentForms,
  getEnrollmentRefundStatus,
  summarizeEnrollmentFormBilling,
} from './enrollmentForms'

describe('enrollmentForms domain', () => {
  const rawFormsFixture = [
    {
      form_id: 12,
      form_sequence: 2,
      reg_type: '續',
      tuition_fee: 1800,
      materials_fee: 100,
      membership_fee: 0,
      handled_by_name: '李承辦',
      reported_on: '2026-08-21',
      notes: '第二張',
      refunded: 1,
      refund_info: '已退費',
      courses: [
        { course_id: 103, course_name: '課程C' },
        { course_id: 104, course_name: '課程D' },
      ],
      billing_receipts: [
        { receipt_id: 203, receipt_kind: 'prepaid', amount: 300, invoice_number: 'P-2' },
        { receipt_id: 204, receipt_kind: 'formal', amount: 1900, invoice_number: 'F-2' },
      ],
    },
    {
      form_id: 11,
      form_sequence: 1,
      reg_type: '一般',
      tuition_fee: 2000,
      materials_fee: 200,
      membership_fee: 100,
      handled_by_name: '王承辦',
      reported_on: '2026-08-20',
      notes: '第一張',
      refunded: false,
      courses: [
        { course_id: 101, course_name: '課程A' },
        { course_id: 102, course_name: '課程B' },
      ],
      billing_receipts: [
        { receipt_id: 201, receipt_kind: 'prepaid', amount: 500, invoice_number: 'P-1' },
        { receipt_id: 202, receipt_kind: 'formal', amount: 2300, invoice_number: 'F-1' },
        { receipt_id: 205, receipt_kind: 'other', amount: 50, invoice_number: 'O-1' },
      ],
    },
  ]

  describe('normalizeEnrollmentForm', () => {
    it('normalizes a single raw form with courses and typed receipts', () => {
      const normalized = normalizeEnrollmentForm(rawFormsFixture[1])

      expect(normalized).toEqual(expect.objectContaining({
        form_id: 11,
        form_sequence: 1,
        reg_type: '一般',
        tuition_fee: 2000,
        materials_fee: 200,
        membership_fee: 100,
        handled_by_name: '王承辦',
        reported_on: '2026-08-20',
        notes: '第一張',
        refunded: false,
        courses: ['課程A', '課程B'],
        courseDetails: [
          { courseId: 101, courseName: '課程A' },
          { courseId: 102, courseName: '課程B' },
        ],
        billingReceipts: [
          { receiptId: 201, receiptKind: 'prepaid', amount: 500, invoiceNumber: 'P-1' },
          { receiptId: 202, receiptKind: 'formal', amount: 2300, invoiceNumber: 'F-1' },
          { receiptId: 205, receiptKind: 'other', amount: 50, invoiceNumber: 'O-1' },
        ],
        prepaid_amount: 500,
        prepaid_receipt_number: 'P-1',
        fee_receipt_number: 'F-1',
        otherReceipts: [
          { receiptId: 205, receiptKind: 'other', amount: 50, invoiceNumber: 'O-1' },
        ],
      }))
    })
  })

  describe('normalizeEnrollmentForms', () => {
    it('sorts forms by form_sequence and normalizes each form', () => {
      const normalizedList = normalizeEnrollmentForms(rawFormsFixture)

      expect(normalizedList).toHaveLength(2)
      expect(normalizedList[0].form_sequence).toBe(1)
      expect(normalizedList[0].form_id).toBe(11)
      expect(normalizedList[0].courses).toEqual(['課程A', '課程B'])
      expect(normalizedList[0].refunded).toBe(false)

      expect(normalizedList[1].form_sequence).toBe(2)
      expect(normalizedList[1].form_id).toBe(12)
      expect(normalizedList[1].courses).toEqual(['課程C', '課程D'])
      expect(normalizedList[1].refunded).toBe(true)
    })
  })

  describe('getEnrollmentRefundStatus', () => {
    it('returns normal when no forms are refunded', () => {
      const forms = [{ refunded: false }, { refunded: false }]
      expect(getEnrollmentRefundStatus(forms)).toBe('normal')
    })

    it('returns partial when some forms are refunded and some are active', () => {
      const forms = [{ refunded: false }, { refunded: true }]
      expect(getEnrollmentRefundStatus(forms)).toBe('partial')
    })

    it('returns refunded when all forms are refunded', () => {
      const forms = [{ refunded: true }, { refunded: true }]
      expect(getEnrollmentRefundStatus(forms)).toBe('refunded')
    })

    it('returns normal when forms array is empty', () => {
      expect(getEnrollmentRefundStatus([])).toBe('normal')
    })
  })

  describe('summarizeEnrollmentFormBilling', () => {
    it('summarizes prepaid, formal, and invoice numbers from a form', () => {
      const form = normalizeEnrollmentForm(rawFormsFixture[1])
      const summary = summarizeEnrollmentFormBilling(form)

      expect(summary).toEqual({
        prepaidAmount: 500,
        formalAmount: 2300,
        prepaidReceiptNumber: 'P-1',
        formalReceiptNumber: 'F-1',
        invoiceNumbers: ['P-1', 'F-1', 'O-1'],
      })
    })

    it('handles zero or null fees correctly', () => {
      const form = normalizeEnrollmentForm({
        form_id: 13,
        form_sequence: 1,
        tuition_fee: null,
        materials_fee: null,
        membership_fee: null,
        courses: [],
        billing_receipts: [],
      })
      const summary = summarizeEnrollmentFormBilling(form)

      expect(summary).toEqual({
        prepaidAmount: null,
        formalAmount: null,
        prepaidReceiptNumber: '',
        formalReceiptNumber: '',
        invoiceNumbers: [],
      })
    })
  })
})
