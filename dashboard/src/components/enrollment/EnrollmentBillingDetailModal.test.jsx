import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import { updateEnrollmentRefundStatus } from '../../services/enrollmentService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentRefundStatus: vi.fn(),
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
  season: '第十六季',
  refunded: false,
  amount: 2400,
  invoice_number: 'LEGACY-MULTI',
  courses: ['水彩', '書法', '瑜珈'],
  prepaid_amount: 500,
  prepaid_receipt_number: 'PRE-01',
  tuition_fee: 1900,
  materials_fee: null,
  membership_fee: 0,
  fee_receipt_number: 'FEE-01',
  handled_by_name: 'Admin',
  handled_by_account: 'admin123',
  handled_on: '2026-08-18',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
  notes: 'Test notes',
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
    vi.mocked(updateEnrollmentRefundStatus).mockReset()
  })

  it('renders refund badge and toggle in the modal header', () => {
    const { container } = renderModal()

    const header = container.querySelector('.modal-header')
    expect(within(header).getByText('正常')).toBeTruthy()
    expect(within(header).getByRole('button', { name: '標記退費' })).toBeTruthy()
  })

  it('renders fee details with prepaid and formal fee breakdown', () => {
    const { container } = renderModal()
    const feeSection = container.querySelector('.enrollment-fee-details')

    expect(feeSection).toBeTruthy()
    expect(within(feeSection).getByText('收費明細')).toBeTruthy()
    expect(within(feeSection).getByText('NT$ 500')).toBeTruthy()
    expect(within(feeSection).getByText('PRE-01')).toBeTruthy()
    expect(within(feeSection).getAllByText('NT$ 1900')).toHaveLength(2) // tuition + total
    expect(within(feeSection).getByText('NT$ 0')).toBeTruthy()
    expect(within(feeSection).getByText('FEE-01')).toBeTruthy()

    const dates = container.querySelector('.enrollment-period-dates')
    expect(dates.textContent).toContain('2026-09-01')
    expect(dates.textContent).toContain('2026-12-31')
  })

  it('renders handler info in a separate section', () => {
    const { container } = renderModal()
    const handlerSection = container.querySelector('.enrollment-handler-info')

    expect(handlerSection).toBeTruthy()
    expect(within(handlerSection).getByText('辦理資訊')).toBeTruthy()
    expect(within(handlerSection).getByText('Admin')).toBeTruthy()
    expect(within(handlerSection).getByText('admin123')).toBeTruthy()
    expect(within(handlerSection).getByText('2026-08-18')).toBeTruthy()
    expect(within(handlerSection).getByText('Test notes')).toBeTruthy()
  })

  it('renders legacy billing section', () => {
    const { container } = renderModal()
    const legacy = container.querySelector('.enrollment-legacy-billing')

    expect(legacy).toBeTruthy()
    expect(legacy.textContent).toContain('NT$ 2400')
    expect(legacy.textContent).toContain('LEGACY-MULTI')
  })

  it('hides refund toggle for viewers', () => {
    authState.role = 'viewer'
    const { container } = renderModal()
    const header = container.querySelector('.modal-header')

    expect(within(header).getByText('正常')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '標記退費' })).toBeNull()
  })

  it('omits empty course context', () => {
    const { container } = renderModal({
      enrollment: { ...enrollment, courses: [] },
    })

    expect(container.querySelector('.enrollment-billing-context')).toBeNull()
  })

  it('marks enrollment as refunded and refreshes on toggle click', async () => {
    vi.mocked(updateEnrollmentRefundStatus).mockResolvedValue(undefined)
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '標記退費' }))

    await waitFor(() => expect(updateEnrollmentRefundStatus).toHaveBeenCalledWith(
      expect.anything(),
      42,
      true,
      null,
    ))
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('cancels refund and refreshes on toggle click', async () => {
    vi.mocked(updateEnrollmentRefundStatus).mockResolvedValue(undefined)
    const { props } = renderModal({ enrollment: { ...enrollment, refunded: true } })

    fireEvent.click(screen.getByRole('button', { name: '取消退費' }))

    await waitFor(() => expect(updateEnrollmentRefundStatus).toHaveBeenCalledWith(
      expect.anything(),
      42,
      false,
      null,
    ))
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('shows an error when the refund toggle fails', async () => {
    vi.mocked(updateEnrollmentRefundStatus).mockRejectedValue(new Error('update denied'))
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '標記退費' }))

    expect((await screen.findByRole('alert')).textContent).toContain('退費狀態更新失敗')
  })
})
