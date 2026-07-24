import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import { updateEnrollmentBilling } from '../../services/enrollmentService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentBilling: vi.fn(),
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
  season: 'Spring 2026',
  courses: ['Watercolor'],
  refunded: false,
  amount: 1200,
  invoice_number: 'AB12345678',
}

describe('EnrollmentBillingDetailModal', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.role = 'editor'
    vi.mocked(updateEnrollmentBilling).mockReset()
  })

  it('renders enrollment context, billing editor, then student details without history visualizations', () => {
    const { container } = render(
      <EnrollmentBillingDetailModal
        student={student}
        enrollment={enrollment}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const text = container.textContent
    expect(text.indexOf('Spring 2026')).toBeLessThan(text.indexOf('Billing'))
    const billingForm = container.querySelector('.enrollment-billing-form')
    const studentSection = container.querySelector('.enrollment-billing-student')
    expect(billingForm.compareDocumentPosition(studentSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(screen.getByDisplayValue('1200')).toBeTruthy()
    expect(screen.getByDisplayValue('AB12345678')).toBeTruthy()
    expect(screen.getByText('Watercolor')).toBeTruthy()
    expect(container.querySelector('.enrollment-billing-history')).toBeNull()
    expect(container.querySelector('.enrollment-billing-chart')).toBeNull()
  })

  it('saves billing values, refreshes data, and stays open', async () => {
    vi.mocked(updateEnrollmentBilling).mockResolvedValue({
      amount: 1500,
      invoice_number: 'CD87654321',
    })
    const onClose = vi.fn()
    const onRefresh = vi.fn()
    render(
      <EnrollmentBillingDetailModal
        student={student}
        enrollment={enrollment}
        onClose={onClose}
        onRefresh={onRefresh}
      />
    )

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText('Invoice number'), { target: { value: ' CD87654321 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save billing' }))

    await screen.findByText('Billing saved')
    expect(updateEnrollmentBilling).toHaveBeenCalledWith(
      expect.anything(),
      42,
      { amount: '1500', invoice_number: ' CD87654321 ' }
    )
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('1500')).toBeTruthy()
    expect(screen.getByDisplayValue('CD87654321')).toBeTruthy()
  })

  it('preserves inputs on failure and prevents duplicate pending saves', async () => {
    let rejectUpdate
    vi.mocked(updateEnrollmentBilling).mockReturnValue(new Promise((_resolve, reject) => {
      rejectUpdate = reject
    }))
    render(
      <EnrollmentBillingDetailModal
        student={student}
        enrollment={enrollment}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    fireEvent.change(screen.getByLabelText('Amount'), { target: { value: '1600' } })
    const saveButton = screen.getByRole('button', { name: 'Save billing' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(updateEnrollmentBilling).toHaveBeenCalledOnce()
    expect(saveButton.disabled).toBe(true)

    rejectUpdate(new Error('update denied'))
    await screen.findByRole('alert')
    expect(screen.getByDisplayValue('1600')).toBeTruthy()
  })

  it('renders billing fields read-only for viewers', () => {
    authState.role = 'viewer'
    render(
      <EnrollmentBillingDetailModal
        student={student}
        enrollment={enrollment}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByLabelText('Amount').readOnly).toBe(true)
    expect(screen.getByLabelText('Invoice number').readOnly).toBe(true)
    expect(screen.queryByRole('button', { name: 'Save billing' })).toBeNull()
  })
})
