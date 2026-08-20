import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import {
  updateEnrollmentFormRefundStatus,
  deleteEnrollmentForm,
} from '../../services/enrollmentService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentFormRefundStatus: vi.fn(),
  deleteEnrollmentForm: vi.fn(),
  updateEnrollmentForm: vi.fn(),
}))

const student = {
  student_id: '1',
  name: 'Wang Student',
  birth_date: '1960-01-01',
  mobile_phone: '0912345678',
}

const enrollment = {
  enrollment_id: 42,
  student_id: '1',
  student_name: 'Wang Student',
  period: '第16期',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
  refundStatus: 'partial',
  refunded: false,
  formCount: 2,
  forms: [
    {
      form_id: 11,
      form_sequence: 1,
      reg_type: '一般',
      courses: ['水彩', '書法'],
      prepaid_amount: 500,
      prepaid_receipt_number: 'PRE-01',
      tuition_fee: 1900,
      materials_fee: null,
      membership_fee: 0,
      fee_receipt_number: 'FEE-01',
      handled_by_name: 'Admin',
      handled_by_account: 'admin123',
      reported_on: '2026-08-18',
      notes: 'Form 1 note',
      refunded: false,
    },
    {
      form_id: 12,
      form_sequence: 2,
      reg_type: '續',
      courses: ['瑜珈'],
      prepaid_amount: 300,
      prepaid_receipt_number: 'PRE-02',
      tuition_fee: 1200,
      materials_fee: 100,
      membership_fee: 0,
      fee_receipt_number: 'FEE-02',
      handled_by_name: 'Staff',
      handled_by_account: 'staff123',
      reported_on: '2026-08-19',
      notes: 'Form 2 note',
      refunded: true,
      refund_info: '退費申請',
    },
  ],
}

function renderModal(overrides = {}) {
  const props = {
    student,
    enrollment,
    onClose: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  }

  return { ...render(<EnrollmentBillingDetailModal {...props} />), props }
}

describe('EnrollmentBillingDetailModal', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    authState.role = 'editor'
    vi.mocked(updateEnrollmentFormRefundStatus).mockReset()
    vi.mocked(deleteEnrollmentForm).mockReset()
  })

  it('renders enrollment period dates and each form card separately', () => {
    const { container } = renderModal()

    expect(screen.getByText('Wang Student · 第16期')).toBeTruthy()
    expect(screen.getByText('部分退費')).toBeTruthy()

    const dates = container.querySelector('.enrollment-period-dates')
    expect(dates.textContent).toContain('2026-09-01')
    expect(dates.textContent).toContain('2026-12-31')

    // Form 1 card
    expect(screen.getByText('報名表 1')).toBeTruthy()
    expect(screen.getByText('水彩')).toBeTruthy()
    expect(screen.getByText('書法')).toBeTruthy()
    expect(screen.getByText('PRE-01')).toBeTruthy()
    expect(screen.getByText('FEE-01')).toBeTruthy()

    // Form 2 card
    expect(screen.getByText('報名表 2')).toBeTruthy()
    expect(screen.getByText('瑜珈')).toBeTruthy()
    expect(screen.getByText('PRE-02')).toBeTruthy()
    expect(screen.getByText('FEE-02')).toBeTruthy()
    expect(screen.getByText('退費申請')).toBeTruthy()
  })

  it('toggles refund status on a specific form card', async () => {
    vi.mocked(updateEnrollmentFormRefundStatus).mockResolvedValue(undefined)
    const { props } = renderModal()

    // Form 1 is not refunded, click mark refund
    fireEvent.click(screen.getByRole('button', { name: '報名表 1 標記退費' }))
    expect(screen.getByText('確定要將「報名表 1」標記為退費嗎？')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '確定退費' }))

    await waitFor(() => expect(updateEnrollmentFormRefundStatus).toHaveBeenCalledWith(
      expect.anything(),
      11,
      true,
      null,
    ))
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('allows admin to delete a form card with confirmation', async () => {
    authState.role = 'admin'
    vi.mocked(deleteEnrollmentForm).mockResolvedValue({ form_id: 12, enrollment_deleted: false })
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除報名表 2' }))
    expect(screen.getByText('確定要刪除「報名表 2」嗎？此操作將刪除此報名表下的所有選課與收據，且無法復原。')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '確定刪除' }))

    await waitFor(() => expect(deleteEnrollmentForm).toHaveBeenCalledWith(
      expect.anything(),
      12,
    ))
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('closes modal if admin deletes the last remaining form', async () => {
    authState.role = 'admin'
    vi.mocked(deleteEnrollmentForm).mockResolvedValue({ form_id: 11, enrollment_deleted: true })
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除報名表 1' }))
    fireEvent.click(screen.getByRole('button', { name: '確定刪除' }))

    await waitFor(() => expect(props.onClose).toHaveBeenCalledOnce())
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('switches a form to edit mode and cancels back', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '編輯報名表 1' }))

    // Form 1 is now an editor
    expect(screen.getByTestId('form-editor-11')).toBeTruthy()
    expect(screen.getByText('編輯報名表 1')).toBeTruthy()

    // Form 2 remains a card
    expect(screen.getByTestId('form-card-12')).toBeTruthy()

    // Cancel edit
    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(screen.queryByTestId('form-editor-11')).toBeNull()
    expect(screen.getByTestId('form-card-11')).toBeTruthy()
  })

  it('hides edit, refund and delete controls for viewers', () => {
    authState.role = 'viewer'
    renderModal()

    expect(screen.queryByRole('button', { name: /標記退費|取消退費/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /編輯報名表/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /刪除報名表/ })).toBeNull()
  })
})
