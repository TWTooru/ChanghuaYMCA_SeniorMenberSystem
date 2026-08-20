import { describe, expect, it } from 'vitest'
import { normalizeInitialEnrollmentForm } from './initialEnrollment'

const validForm = {
  period: '  第16期  ',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
  courses: [' 肌力訓練 ', '肌力訓練', '北歐健走'],
  notes: '  需靠近出口  ',
  prepaid_amount: '',
  prepaid_receipt_number: ' P-001 ',
  tuition_fee: '2400',
  materials_fee: '0',
  membership_fee: '',
  fee_receipt_number: ' F-001 ',
  handled_by_name: ' 王小姐 ',
  handled_on: '2026-08-17',
}

describe('normalizeInitialEnrollmentForm', () => {
  it('normalizes dates, courses, optional text, and nullable integer fees', () => {
    expect(normalizeInitialEnrollmentForm(validForm)).toEqual({
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      reg_type: '續',
      refunded: false,
      refund_info: null,
      courses: ['肌力訓練', '北歐健走'],
      notes: '需靠近出口',
      prepaid_amount: null,
      prepaid_receipt_number: 'P-001',
      tuition_fee: 2400,
      materials_fee: 0,
      membership_fee: null,
      fee_receipt_number: 'F-001',
      handled_by_name: '王小姐',
      handled_on: '2026-08-17',
      reported_on: '2026-08-17',
    })
  })

  it.each([
    [{ ...validForm, period: '第一期' }, '請輸入有效期別，例如：第16期'],
    [{ ...validForm, period_start_date: '' }, '請選擇開始日期與結束日期'],
    [{ ...validForm, period_end_date: '2026-08-31' }, '結束日期不得早於開始日期'],
    [{ ...validForm, courses: [] }, '請至少選擇一門課程'],
    [{ ...validForm, tuition_fee: '-1' }, '金額必須是 0 或正整數'],
    [{ ...validForm, materials_fee: '1.5' }, '金額必須是 0 或正整數'],
    [{ ...validForm, membership_fee: '2147483648' }, '金額必須是 0 或正整數'],
  ])('rejects invalid form %#', (form, message) => {
    expect(() => normalizeInitialEnrollmentForm(form)).toThrow(message)
  })
})
