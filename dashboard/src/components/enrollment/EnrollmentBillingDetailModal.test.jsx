import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import {
  createBillingReceipt,
  deleteBillingReceipt,
  updateBillingReceipt,
} from '../../services/billingReceiptService'
import { updateEnrollmentRefundStatus } from '../../services/enrollmentService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../../services/billingReceiptService', () => ({
  createBillingReceipt: vi.fn(),
  deleteBillingReceipt: vi.fn(),
  updateBillingReceipt: vi.fn(),
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
  courseDetails: [
    { courseId: 10, courseName: '水彩', billingReceiptId: 100 },
    { courseId: 11, courseName: '書法', billingReceiptId: 100 },
    { courseId: 12, courseName: '瑜珈', billingReceiptId: null },
  ],
  billingReceipts: [{
    receiptId: 100,
    amount: 2400,
    invoiceNumber: 'R-100',
    courses: [
      { courseId: 10, courseName: '水彩' },
      { courseId: 11, courseName: '書法' },
    ],
  }],
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

function beginCreatingReceipt(courseNames = ['瑜珈']) {
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  courseNames.forEach(courseName => fireEvent.click(screen.getByLabelText(courseName)))
}

describe('EnrollmentBillingDetailModal', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    authState.role = 'editor'
    vi.mocked(createBillingReceipt).mockReset()
    vi.mocked(deleteBillingReceipt).mockReset()
    vi.mocked(updateBillingReceipt).mockReset()
    vi.mocked(updateEnrollmentRefundStatus).mockReset()
  })

  it('renders one payment row for multiple courses without double-counting', () => {
    const { container } = renderModal()

    const rows = container.querySelectorAll('.billing-receipt-row')
    const row = rows[0]
    expect(rows).toHaveLength(1)
    expect(within(row).getByText('水彩')).toBeTruthy()
    expect(within(row).getByText('書法')).toBeTruthy()
    expect(within(row).getAllByText('NT$ 2400')).toHaveLength(1)
    expect(within(row).getAllByText('R-100')).toHaveLength(1)
    expect(within(row).getByText('收據編號')).toBeTruthy()
  })

  it('renders grouped payments, legacy billing, and student details in order', () => {
    const { container } = renderModal()

    const context = container.querySelector('.enrollment-billing-context')
    const receipts = container.querySelector('.enrollment-billing-receipts')
    const row = container.querySelector('.billing-receipt-row')
    const legacy = container.querySelector('.enrollment-legacy-billing')
    const studentSection = container.querySelector('.enrollment-billing-student')

    expect(context.compareDocumentPosition(receipts)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(receipts.compareDocumentPosition(legacy)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(legacy.compareDocumentPosition(studentSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(row).getByRole('button', { name: '編輯' })).toBeTruthy()
    expect(within(row).getByRole('button', { name: '刪除' })).toBeTruthy()
    expect(within(legacy).getByText('NT$ 2400')).toBeTruthy()
    expect(within(legacy).getByText('LEGACY-MULTI')).toBeTruthy()
  })

  it('keeps multiple grouped payment headers isolated', () => {
    const secondReceiptEnrollment = {
      ...enrollment,
      courseDetails: enrollment.courseDetails.map(course => (
        course.courseId === 12 ? { ...course, billingReceiptId: 101 } : course
      )),
      billingReceipts: [
        ...enrollment.billingReceipts,
        {
          receiptId: 101,
          amount: 900,
          invoiceNumber: 'R-101',
          courses: [{ courseId: 12, courseName: '瑜珈' }],
        },
      ],
    }
    const { container } = renderModal({ enrollment: secondReceiptEnrollment })

    const rows = container.querySelectorAll('.billing-receipt-row')
    expect(rows).toHaveLength(2)
    expect(within(rows[0]).getByText('水彩')).toBeTruthy()
    expect(within(rows[0]).getByText('書法')).toBeTruthy()
    expect(within(rows[0]).getByText('NT$ 2400')).toBeTruthy()
    expect(within(rows[0]).queryByText('瑜珈')).toBeNull()
    expect(within(rows[1]).getByText('瑜珈')).toBeTruthy()
    expect(within(rows[1]).getByText('NT$ 900')).toBeTruthy()
    expect(within(rows[1]).getByText('R-101')).toBeTruthy()
    expect(within(rows[1]).queryByText('水彩')).toBeNull()
  })

  it('creates one payment for multiple unbilled courses', async () => {
    const expandedEnrollment = {
      ...enrollment,
      courses: [...enrollment.courses, '太極'],
      courseDetails: [
        ...enrollment.courseDetails,
        { courseId: 13, courseName: '太極', billingReceiptId: null },
      ],
    }
    vi.mocked(createBillingReceipt).mockResolvedValue({
      receiptId: 101,
      courseIds: [12, 13],
      amount: 3000,
      invoiceNumber: 'R-101',
    })
    const { props } = renderModal({ enrollment: expandedEnrollment })

    beginCreatingReceipt(['瑜珈', '太極'])
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('收據編號'), { target: { value: 'R-101' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    await waitFor(() => expect(createBillingReceipt).toHaveBeenCalledWith(
      expect.anything(),
      [12, 13],
      { amount: '3000', invoiceNumber: 'R-101' },
    ))
    expect(await screen.findByText('繳費紀錄已儲存')).toBeTruthy()
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('offers only courses without a grouped payment', () => {
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))

    expect(screen.getByLabelText('瑜珈')).toBeTruthy()
    expect(screen.queryByLabelText('水彩')).toBeNull()
    expect(screen.queryByLabelText('書法')).toBeNull()
  })

  it('rejects an empty amount inline without calling the service', async () => {
    renderModal()

    beginCreatingReceipt()
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    expect((await screen.findByRole('alert')).textContent).toContain('金額必須為 0 或正整數')
    expect(createBillingReceipt).not.toHaveBeenCalled()
    expect(screen.getByLabelText('瑜珈').checked).toBe(true)
  })

  it('updates the grouped receipt header without changing its course membership', async () => {
    vi.mocked(updateBillingReceipt).mockResolvedValue({
      receiptId: 100,
      courseIds: [10, 11],
      amount: 2600,
      invoiceNumber: 'R-UPDATED',
    })
    const { container } = renderModal()

    fireEvent.click(within(container.querySelector('.billing-receipt-row')).getByRole('button', { name: '編輯' }))
    const editor = container.querySelector('.billing-receipt-editor')
    expect(within(editor).getByText('水彩')).toBeTruthy()
    expect(within(editor).getByText('書法')).toBeTruthy()
    expect(within(editor).queryByRole('checkbox')).toBeNull()
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '2600' } })
    fireEvent.change(screen.getByLabelText('收據編號'), { target: { value: ' R-UPDATED ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    await waitFor(() => expect(updateBillingReceipt).toHaveBeenCalledWith(
      expect.anything(),
      100,
      { amount: '2600', invoiceNumber: ' R-UPDATED ' },
    ))
  })

  it('keeps selected courses and values when saving fails', async () => {
    vi.mocked(createBillingReceipt).mockRejectedValue(new Error('create denied'))
    renderModal()

    beginCreatingReceipt()
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '1600' } })
    fireEvent.change(screen.getByLabelText('收據編號'), { target: { value: ' R-NEW ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    expect((await screen.findByRole('alert')).textContent).toContain('create denied')
    expect(screen.getByLabelText('瑜珈').checked).toBe(true)
    expect(screen.getByDisplayValue('1600')).toBeTruthy()
    expect(screen.getByLabelText('收據編號').value).toBe(' R-NEW ')
  })

  it('refreshes stale data when selected courses already have a payment', async () => {
    vi.mocked(createBillingReceipt).mockRejectedValue(new Error('所選課程已經有付款資料'))
    const { props } = renderModal()

    beginCreatingReceipt()
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '1600' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    expect((await screen.findByRole('alert')).textContent).toContain('所選課程已經有付款資料')
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('prevents duplicate saves and locks navigation while a request is pending', () => {
    vi.mocked(createBillingReceipt).mockReturnValue(new Promise(() => {}))
    const { container, props } = renderModal()

    beginCreatingReceipt()
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '1600' } })
    const saveButton = screen.getByRole('button', { name: '儲存繳費紀錄' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(createBillingReceipt).toHaveBeenCalledOnce()
    expect(saveButton.disabled).toBe(true)
    expect(screen.getByRole('button', { name: '新增繳費紀錄' }).disabled).toBe(true)
    expect(within(container.querySelector('.billing-receipt-row')).getByRole('button', { name: '編輯' }).disabled).toBe(true)
    expect(within(container.querySelector('.billing-receipt-row')).getByRole('button', { name: '刪除' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: 'Close enrollment billing details' }).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close enrollment billing details' }))
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('1600')).toBeTruthy()
  })

  it('shows grouped payment values to viewers without mutation controls', () => {
    authState.role = 'viewer'
    const { container } = renderModal()
    const receipts = container.querySelector('.enrollment-billing-receipts')

    expect(within(receipts).getByText('NT$ 2400')).toBeTruthy()
    expect(within(receipts).getByText('R-100')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '新增繳費紀錄' })).toBeNull()
    expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
    expect(screen.queryByRole('button', { name: '刪除' })).toBeNull()
    expect(screen.queryByRole('button', { name: '儲存繳費紀錄' })).toBeNull()
  })

  it('shows grouped payment mutation actions to administrators', () => {
    authState.role = 'admin'
    const { container } = renderModal()

    expect(within(container.querySelector('.billing-receipt-row')).getByRole('button', { name: '編輯' })).toBeTruthy()
    expect(within(container.querySelector('.billing-receipt-row')).getByRole('button', { name: '刪除' })).toBeTruthy()
  })

  it('does not delete or refresh when grouped payment deletion is cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    expect(confirm).toHaveBeenCalledWith('確定刪除此筆繳費紀錄？金額與收據編號將無法復原。')
    expect(deleteBillingReceipt).not.toHaveBeenCalled()
    expect(props.onRefresh).not.toHaveBeenCalled()
  })

  it('deletes the grouped receipt header and refreshes while keeping the modal open', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteBillingReceipt).mockResolvedValue(undefined)
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    await waitFor(() => expect(deleteBillingReceipt).toHaveBeenCalledWith(expect.anything(), 100))
    expect(await screen.findByText('繳費紀錄已刪除')).toBeTruthy()
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('keeps the grouped receipt visible and reports a deletion failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteBillingReceipt).mockRejectedValue(new Error('delete denied'))
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    expect((await screen.findByRole('alert')).textContent).toContain('delete denied')
    expect(screen.getByText('R-100')).toBeTruthy()
  })

  it('closes the matching inline editor after deleting that grouped receipt', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteBillingReceipt).mockResolvedValue(undefined)
    const { container } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect(container.querySelector('.billing-receipt-editor')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    await screen.findByText('繳費紀錄已刪除')
    expect(container.querySelector('.billing-receipt-editor')).toBeNull()
  })

  it('rejects create when a selected course has no valid course ID', async () => {
    renderModal({
      enrollment: {
        ...enrollment,
        courses: ['未識別課程'],
        courseDetails: [{ courseName: '未識別課程', billingReceiptId: null }],
        billingReceipts: [],
      },
    })

    beginCreatingReceipt(['未識別課程'])
    fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))

    expect((await screen.findByRole('alert')).textContent).toContain('課程資料已更新，請重新載入後再試')
    expect(createBillingReceipt).not.toHaveBeenCalled()
  })

  it('rejects edit when a grouped receipt has no valid ID', async () => {
    const invalidEnrollment = {
      ...enrollment,
      billingReceipts: [{ ...enrollment.billingReceipts[0], receiptId: null }],
    }
    renderModal({ enrollment: invalidEnrollment })

    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect((await screen.findByRole('alert')).textContent).toContain('繳費資料已更新，請重新載入後再試')
  })

  it('rejects delete before confirmation when a grouped receipt has no valid ID', async () => {
    const confirm = vi.spyOn(window, 'confirm')
    const invalidEnrollment = {
      ...enrollment,
      billingReceipts: [{ ...enrollment.billingReceipts[0], receiptId: null }],
    }
    renderModal({ enrollment: invalidEnrollment })

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    expect((await screen.findByRole('alert')).textContent).toContain('繳費資料已更新，請重新載入後再試')
    expect(confirm).not.toHaveBeenCalled()
    expect(deleteBillingReceipt).not.toHaveBeenCalled()
  })

  it('disables creating when every course is assigned and renders blank values as placeholders', () => {
    const completeEnrollment = {
      ...enrollment,
      courseDetails: enrollment.courseDetails.map(course => ({ ...course, billingReceiptId: 100 })),
      billingReceipts: [{ ...enrollment.billingReceipts[0], amount: null, invoiceNumber: '' }],
    }
    const { container } = renderModal({ enrollment: completeEnrollment })

    expect(screen.getByRole('button', { name: '新增繳費紀錄' }).disabled).toBe(true)
    expect(within(container.querySelector('.billing-receipt-row')).getAllByText('--')).toHaveLength(2)
  })

  it('omits empty course context and keeps refund status beside the payment heading', () => {
    const { container } = renderModal({
      enrollment: { ...enrollment, courses: [], courseDetails: [], billingReceipts: [] },
    })

    expect(container.querySelector('.enrollment-billing-context')).toBeNull()
    const heading = container.querySelector('.enrollment-billing-heading')
    expect(heading?.querySelector('h3')?.textContent).toBe('繳費紀錄')
    expect(heading?.querySelector('.badge.success')?.textContent).toBe('正常')
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
