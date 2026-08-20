import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnrollmentFormCard from './EnrollmentFormCard'

const formFixture = {
  form_id: 12,
  form_sequence: 2,
  reg_type: '續',
  courses: ['課程C', '課程D'],
  prepaid_amount: 300,
  prepaid_receipt_number: 'P-2',
  tuition_fee: 1800,
  materials_fee: 100,
  membership_fee: 0,
  fee_receipt_number: 'F-2',
  handled_by_name: '李承辦',
  handled_by_account: 'lee@example.com',
  reported_on: '2026-08-21',
  notes: '第二張備註',
  refunded: true,
  refund_info: '因傷退費',
  otherReceipts: [{ receiptId: 99, amount: 50, invoiceNumber: 'O-2' }],
}

describe('EnrollmentFormCard', () => {
  afterEach(cleanup)

  it('renders form 2 details, courses, receipts, handler and refund badge independently', () => {
    render(<EnrollmentFormCard form={formFixture} canEdit={true} canDelete={true} />)

    expect(screen.getByText('報名表 2')).toBeTruthy()
    expect(screen.getByText('退費')).toBeTruthy()
    expect(screen.getByText('續')).toBeTruthy()
    expect(screen.getByText('課程C')).toBeTruthy()
    expect(screen.getByText('課程D')).toBeTruthy()
    expect(screen.getByText('NT$ 300')).toBeTruthy()
    expect(screen.getByText('P-2')).toBeTruthy()
    expect(screen.getByText('NT$ 1800')).toBeTruthy()
    expect(screen.getByText('NT$ 100')).toBeTruthy()
    expect(screen.getByText('NT$ 0')).toBeTruthy()
    expect(screen.getByText('NT$ 1900')).toBeTruthy() // total
    expect(screen.getByText('F-2')).toBeTruthy()
    expect(screen.getByText('李承辦')).toBeTruthy()
    expect(screen.getByText('2026-08-21')).toBeTruthy()
    expect(screen.getByText('lee@example.com')).toBeTruthy()
    expect(screen.getByText('第二張備註')).toBeTruthy()
    expect(screen.getByText('因傷退費')).toBeTruthy()
    expect(screen.getByText('歷史收據')).toBeTruthy()
    expect(screen.getByText('No. O-2')).toBeTruthy()
  })

  it('triggers onEdit, onToggleRefund, and onDelete callbacks with form', () => {
    const onEdit = vi.fn()
    const onToggleRefund = vi.fn()
    const onDelete = vi.fn()

    render(
      <EnrollmentFormCard
        form={formFixture}
        canEdit={true}
        canDelete={true}
        onEdit={onEdit}
        onToggleRefund={onToggleRefund}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    expect(onEdit).toHaveBeenCalledWith(formFixture)

    fireEvent.click(screen.getByRole('button', { name: /取消退費/ }))
    expect(onToggleRefund).toHaveBeenCalledWith(formFixture)

    fireEvent.click(screen.getByRole('button', { name: /刪除/ }))
    expect(onDelete).toHaveBeenCalledWith(formFixture)
  })

  it('hides edit, refund and delete buttons when canEdit/canDelete are false', () => {
    render(<EnrollmentFormCard form={formFixture} canEdit={false} canDelete={false} />)

    expect(screen.queryByRole('button', { name: /編輯/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /取消退費/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /標記退費/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /刪除/ })).toBeNull()
  })
})
