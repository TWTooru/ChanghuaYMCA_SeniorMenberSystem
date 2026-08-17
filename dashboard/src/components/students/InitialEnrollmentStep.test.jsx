import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import InitialEnrollmentStep from './InitialEnrollmentStep'

vi.mock('../enrollment/CourseTagPicker', () => ({
  default: ({ onChange }) => <button type="button" onClick={() => onChange(['瑜珈基礎'])}>選擇瑜珈基礎</button>,
}))

const enrollment = {
  period: '第16期',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
  courses: [],
  notes: '',
  prepaid_amount: '',
  prepaid_receipt_number: '',
  tuition_fee: '',
  materials_fee: '',
  membership_fee: '',
  fee_receipt_number: '',
  handled_by_name: '',
  handled_on: '',
}

describe('InitialEnrollmentStep', () => {
  afterEach(cleanup)

  it('renders the enrollment fields with the required browser semantics', () => {
    const onCoursesChange = vi.fn()
    render(<InitialEnrollmentStep enrollment={enrollment} onChange={vi.fn()} onCoursesChange={onCoursesChange} account="editor@example.com" disabled={false} />)

    for (const label of [
      '期別', '開始日期', '結束日期', '預繳金額', '預繳 No.',
      '學費', '教材費', '會友費', '正式收據 No.', '備註',
      '經手人姓名', '登入帳號（自動帶入）', '辦理日期',
    ]) expect(screen.getByLabelText(label)).not.toBeNull()

    expect(screen.getByLabelText('開始日期').type).toBe('date')
    expect(screen.getByLabelText('結束日期').type).toBe('date')
    expect(screen.getByLabelText('辦理日期').type).toBe('date')
    expect(screen.getByLabelText('登入帳號（自動帶入）').readOnly).toBe(true)
    expect(screen.getByLabelText('登入帳號（自動帶入）').value).toBe('editor@example.com')
    expect(screen.getByLabelText('備註').tagName).toBe('TEXTAREA')

    for (const label of ['預繳金額', '學費', '教材費', '會友費']) {
      const field = screen.getByLabelText(label)
      expect(field.type).toBe('number')
      expect(field.min).toBe('0')
      expect(field.step).toBe('1')
    }
    for (const label of ['期別', '開始日期', '結束日期']) expect(screen.getByLabelText(label).required).toBe(true)
    for (const label of ['預繳金額', '預繳 No.', '學費', '教材費', '會友費', '正式收據 No.', '備註', '經手人姓名', '登入帳號（自動帶入）', '辦理日期']) expect(screen.getByLabelText(label).required).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '選擇瑜珈基礎' }))
    expect(onCoursesChange).toHaveBeenCalledWith(['瑜珈基礎'])
  })
})
