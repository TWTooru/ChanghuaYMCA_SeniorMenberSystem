import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import { updateEnrollmentBillingDetails, updateEnrollmentRefundStatus } from '../../services/enrollmentService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentRefundStatus: vi.fn(),
  updateEnrollmentBillingDetails: vi.fn(),
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
    vi.mocked(updateEnrollmentBillingDetails).mockReset()
  })

  it('renders refund badge, refund toggle, and edit button in the modal header', () => {
    const { container } = renderModal()

    const header = container.querySelector('.modal-header')
    expect(within(header).getByText('正常')).toBeTruthy()
    expect(within(header).getByRole('button', { name: '標記退費' })).toBeTruthy()
    expect(within(header).getByRole('button', { name: '編輯' })).toBeTruthy()
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

  it('hides refund toggle and edit button for viewers', () => {
    authState.role = 'viewer'
    const { container } = renderModal()
    const header = container.querySelector('.modal-header')

    expect(within(header).getByText('正常')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '標記退費' })).toBeNull()
    expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
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

  describe('In-place Editing', () => {
    it('switches to edit mode and renders editable input fields with initial values', () => {
      renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))

      // Buttons switched
      expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
      expect(screen.queryByRole('button', { name: '標記退費' })).toBeNull()
      expect(screen.getByRole('button', { name: '儲存' })).toBeTruthy()
      expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()

      // Inputs rendered with initial values
      expect(screen.getByLabelText('預繳金額').value).toBe('500')
      expect(screen.getByLabelText('預繳收據號碼').value).toBe('PRE-01')
      expect(screen.getByLabelText('學費').value).toBe('1900')
      expect(screen.getByLabelText('教材費').value).toBe('')
      expect(screen.getByLabelText('會友費').value).toBe('0')
      expect(screen.getByLabelText('正式收據號碼').value).toBe('FEE-01')
      expect(screen.getByLabelText('經手人').value).toBe('Admin')
      expect(screen.getByLabelText('辦理日期').value).toBe('2026-08-18')
      expect(screen.getByLabelText('備註').value).toBe('Test notes')

      // Handled by account remains read-only text
      expect(screen.getByText('admin123')).toBeTruthy()
      expect(screen.queryByLabelText('登入帳號')).toBeNull()
    })

    it('dynamically calculates total formal fee in edit mode', () => {
      renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))

      const tuitionInput = screen.getByLabelText('學費')
      const materialsInput = screen.getByLabelText('教材費')
      const membershipInput = screen.getByLabelText('會友費')

      fireEvent.change(tuitionInput, { target: { value: '2000' } })
      fireEvent.change(materialsInput, { target: { value: '350' } })
      fireEvent.change(membershipInput, { target: { value: '150' } })

      expect(screen.getByLabelText('正式費用合計').textContent).toBe('NT$ 2500')
    })

    it('cancels edit mode and reverts changes', () => {
      renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))
      fireEvent.change(screen.getByLabelText('學費'), { target: { value: '9999' } })

      fireEvent.click(screen.getByRole('button', { name: '取消' }))

      // Back to view mode
      expect(screen.getByRole('button', { name: '編輯' })).toBeTruthy()
      expect(screen.queryByLabelText('學費')).toBeNull()
      expect(screen.getAllByText('NT$ 1900')).toHaveLength(2)
      expect(updateEnrollmentBillingDetails).not.toHaveBeenCalled()
    })

    it('validates negative amounts and does not call service', async () => {
      renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))
      fireEvent.change(screen.getByLabelText('預繳金額'), { target: { value: '-100' } })

      fireEvent.click(screen.getByRole('button', { name: '儲存' }))

      expect(await screen.findByRole('alert')).toBeTruthy()
      expect(screen.getByRole('alert').textContent).toContain('金額必須為非負整數')
      expect(updateEnrollmentBillingDetails).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: '儲存' })).toBeTruthy()
    })

    it('saves billing details successfully, calls onRefresh, and returns to view mode', async () => {
      vi.mocked(updateEnrollmentBillingDetails).mockResolvedValue(undefined)
      const { props } = renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))

      fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2500' } })
      fireEvent.change(screen.getByLabelText('教材費'), { target: { value: '300' } })
      fireEvent.change(screen.getByLabelText('經手人'), { target: { value: 'Manager Lee' } })
      fireEvent.change(screen.getByLabelText('備註'), { target: { value: 'Updated note' } })

      fireEvent.click(screen.getByRole('button', { name: '儲存' }))

      await waitFor(() => {
        expect(updateEnrollmentBillingDetails).toHaveBeenCalledWith(
          expect.anything(),
          42,
          expect.objectContaining({
            prepaid_amount: 500,
            prepaid_receipt_number: 'PRE-01',
            tuition_fee: '2500',
            materials_fee: '300',
            membership_fee: 0,
            fee_receipt_number: 'FEE-01',
            handled_by_name: 'Manager Lee',
            handled_on: '2026-08-18',
            notes: 'Updated note',
          }),
        )
      })

      expect(await screen.findByText('帳單明細已更新')).toBeTruthy()
      expect(props.onRefresh).toHaveBeenCalledOnce()
      expect(screen.getByRole('button', { name: '編輯' })).toBeTruthy()
      expect(screen.queryByRole('button', { name: '儲存' })).toBeNull()
    })

    it('shows error when save fails and remains in edit mode', async () => {
      vi.mocked(updateEnrollmentBillingDetails).mockRejectedValue(new Error('Update failed'))
      renderModal()

      fireEvent.click(screen.getByRole('button', { name: '編輯' }))
      fireEvent.click(screen.getByRole('button', { name: '儲存' }))

      expect((await screen.findByRole('alert')).textContent).toContain('Update failed')
      expect(screen.getByRole('button', { name: '儲存' })).toBeTruthy()
    })
  })
})
