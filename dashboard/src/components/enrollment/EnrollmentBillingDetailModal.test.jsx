import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentBillingDetailModal from './EnrollmentBillingDetailModal'
import {
  createCourseReceipt,
  deleteCourseReceipt,
  updateCourseReceipt,
} from '../../services/courseReceiptService'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))
vi.mock('../../services/courseReceiptService', () => ({
  createCourseReceipt: vi.fn(),
  deleteCourseReceipt: vi.fn(),
  updateCourseReceipt: vi.fn(),
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
  courses: ['水彩', '書法'],
  refunded: false,
  amount: 2400,
  invoice_number: 'LEGACY-MULTI',
  courseDetails: [
    {
      courseId: 10,
      courseName: '水彩',
      receipt: { receiptId: 100, amount: 1200, invoiceNumber: 'R-100' },
    },
    { courseId: 11, courseName: '書法', receipt: null },
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

// 此 helper 依序選擇課程並開啟內嵌編輯器，讓建立、忙碌狀態與重新整理相關測試共用相同互動流程。
function beginCreatingReceipt(courseName = '書法') {
  fireEvent.click(screen.getByRole('button', { name: '新增收據' }))
  fireEvent.click(screen.getByRole('button', { name: courseName }))
}

describe('EnrollmentBillingDetailModal', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    authState.role = 'editor'
    vi.mocked(createCourseReceipt).mockReset()
    vi.mocked(deleteCourseReceipt).mockReset()
    vi.mocked(updateCourseReceipt).mockReset()
  })

  it('renders course receipts, legacy billing, and student details in order', () => {
    const { container } = renderModal()

    const context = container.querySelector('.enrollment-billing-context')
    const receipts = container.querySelector('.enrollment-billing-receipts')
    const receiptRow = within(receipts).getByText('水彩').closest('.course-receipt-row')
    const legacy = container.querySelector('.enrollment-legacy-billing')
    const studentSection = container.querySelector('.enrollment-billing-student')

    expect(context.compareDocumentPosition(receipts)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(receipts.compareDocumentPosition(legacy)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(legacy.compareDocumentPosition(studentSection)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
    expect(within(receiptRow).getByText('NT$ 1200')).toBeTruthy()
    expect(within(receiptRow).getByText('R-100')).toBeTruthy()
    expect(within(receiptRow).getByRole('button', { name: '編輯' })).toBeTruthy()
    expect(within(receiptRow).getByRole('button', { name: '刪除' })).toBeTruthy()
    expect(within(legacy).getByText('舊制帳單')).toBeTruthy()
    expect(within(legacy).getByText('NT$ 2400')).toBeTruthy()
    expect(within(legacy).getByText('LEGACY-MULTI')).toBeTruthy()
    expect(container.querySelector('.enrollment-billing-history')).toBeNull()
    expect(container.querySelector('.enrollment-billing-chart')).toBeNull()
  })

  it('offers only enrolled courses that do not already have receipts', () => {
    const { container } = renderModal()
    const addButton = screen.getByRole('button', { name: '新增收據' })

    expect(addButton.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(addButton)

    const options = container.querySelector('.course-receipt-course-options')
    expect(addButton.getAttribute('aria-expanded')).toBe('true')
    expect(addButton.getAttribute('aria-controls')).toBe(options.id)
    expect(within(options).getByRole('button', { name: '書法' })).toBeTruthy()
    expect(within(options).queryByRole('button', { name: '水彩' })).toBeNull()
    expect(within(options).queryByRole('button', { name: '不相關課程' })).toBeNull()
  })

  it('creates a blank receipt for the selected enrolled course', async () => {
    vi.mocked(createCourseReceipt).mockResolvedValue({
      receiptId: 101,
      courseId: 11,
      amount: null,
      invoiceNumber: null,
    })
    const { props, rerender } = renderModal()

    beginCreatingReceipt()
    fireEvent.click(screen.getByRole('button', { name: '儲存收據' }))

    await screen.findByText('收據已儲存')
    expect(createCourseReceipt).toHaveBeenCalledWith(
      expect.anything(),
      11,
      { amount: '', invoice_number: '' }
    )
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '儲存收據' })).toBeNull()

    rerender(
      <EnrollmentBillingDetailModal
        {...props}
        enrollment={{
          ...enrollment,
          courseDetails: [
            ...enrollment.courseDetails.slice(0, 1),
            {
              courseId: 11,
              courseName: '書法',
              receipt: { receiptId: 101, amount: null, invoiceNumber: null },
            },
          ],
        }}
      />
    )
    expect(screen.getByText('收據已儲存')).toBeTruthy()
  })

  it('updates the receipt ID belonging to the selected receipt row', async () => {
    vi.mocked(updateCourseReceipt).mockResolvedValue({
      receiptId: 100,
      courseId: 10,
      amount: 1500,
      invoiceNumber: 'R-UPDATED',
    })
    const { container } = renderModal()
    const receiptRow = within(container.querySelector('.enrollment-billing-receipts'))
      .getByText('水彩')
      .closest('.course-receipt-row')

    fireEvent.click(within(receiptRow).getByRole('button', { name: '編輯' }))
    fireEvent.change(screen.getByLabelText('金額'), { target: { value: '1500' } })
    fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: ' R-UPDATED ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存收據' }))

    await waitFor(() => {
      expect(updateCourseReceipt).toHaveBeenCalledWith(
        expect.anything(),
        100,
        { amount: '1500', invoice_number: ' R-UPDATED ' }
      )
    })
  })

  it('prevents duplicate receipt saves while a request is pending', () => {
    vi.mocked(createCourseReceipt).mockReturnValue(new Promise(() => {}))
    renderModal()

    beginCreatingReceipt()
    const saveButton = screen.getByRole('button', { name: '儲存收據' })
    fireEvent.click(saveButton)
    fireEvent.click(saveButton)

    expect(createCourseReceipt).toHaveBeenCalledOnce()
    expect(saveButton.disabled).toBe(true)
  })

  it('locks receipt navigation while a save request is pending', () => {
    vi.mocked(createCourseReceipt).mockReturnValue(new Promise(() => {}))
    const { container } = renderModal()
    const existingReceiptRow = within(container.querySelector('.enrollment-billing-receipts'))
      .getByText('水彩')
      .closest('.course-receipt-row')

    beginCreatingReceipt()
    fireEvent.change(screen.getByLabelText('金額'), { target: { value: '1600' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存收據' }))

    const addButton = screen.getByRole('button', { name: '新增收據' })
    const editButton = within(existingReceiptRow).getByRole('button', { name: '編輯' })
    const deleteButton = within(existingReceiptRow).getByRole('button', { name: '刪除' })
    expect(addButton.disabled).toBe(true)
    expect(editButton.disabled).toBe(true)
    expect(deleteButton.disabled).toBe(true)

    fireEvent.click(editButton)
    fireEvent.click(addButton)

    const editor = container.querySelector('.course-receipt-editor')
    expect(within(editor).getByText('書法')).toBeTruthy()
    expect(screen.getByDisplayValue('1600')).toBeTruthy()
    expect(createCourseReceipt).toHaveBeenCalledOnce()
  })

  it('preserves the selected course and inputs when saving fails', async () => {
    vi.mocked(createCourseReceipt).mockRejectedValue(new Error('create denied'))
    const { container } = renderModal()

    beginCreatingReceipt()
    fireEvent.change(screen.getByLabelText('金額'), { target: { value: '1600' } })
    fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: ' R-NEW ' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存收據' }))

    expect((await screen.findByRole('alert')).textContent).toContain('create denied')
    const editor = container.querySelector('.course-receipt-editor')
    expect(within(editor).getByText('書法')).toBeTruthy()
    expect(screen.getByDisplayValue('1600')).toBeTruthy()
    expect(screen.getByLabelText('發票編號').value).toBe(' R-NEW ')
  })

  it('refreshes stale data when the service reports an existing receipt conflict', async () => {
    vi.mocked(createCourseReceipt).mockRejectedValue(
      new Error('此課程已有收據，請重新整理後再編輯')
    )
    const { props } = renderModal()

    beginCreatingReceipt()
    fireEvent.click(screen.getByRole('button', { name: '儲存收據' }))

    expect((await screen.findByRole('alert')).textContent).toContain('此課程已有收據，請重新整理後再編輯')
    expect(props.onRefresh).toHaveBeenCalledOnce()
  })

  it('disables receipt creation and renders blank values as placeholders when all courses have receipts', () => {
    const completeEnrollment = {
      ...enrollment,
      courseDetails: [
        ...enrollment.courseDetails.slice(0, 1),
        {
          courseId: 11,
          courseName: '書法',
          receipt: { receiptId: 101, amount: null, invoiceNumber: '' },
        },
      ],
    }
    const { container } = renderModal({ enrollment: completeEnrollment })

    const addButton = screen.getByRole('button', { name: '所有課程都已建立收據' })
    const blankReceiptRow = within(container.querySelector('.enrollment-billing-receipts'))
      .getByText('書法')
      .closest('.course-receipt-row')
    expect(addButton.disabled).toBe(true)
    expect(within(blankReceiptRow).getAllByText('--')).toHaveLength(2)
  })

  it('shows receipt and legacy values to viewers without receipt actions', () => {
    authState.role = 'viewer'
    const { container } = renderModal()
    const receipts = container.querySelector('.enrollment-billing-receipts')
    const legacy = container.querySelector('.enrollment-legacy-billing')

    expect(within(receipts).getByText('NT$ 1200')).toBeTruthy()
    expect(within(receipts).getByText('R-100')).toBeTruthy()
    expect(within(legacy).getByText('NT$ 2400')).toBeTruthy()
    expect(within(legacy).getByText('LEGACY-MULTI')).toBeTruthy()
    expect(screen.queryByRole('button', { name: '新增收據' })).toBeNull()
    expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
    expect(screen.queryByRole('button', { name: '刪除' })).toBeNull()
    expect(screen.queryByRole('button', { name: '儲存收據' })).toBeNull()
  })

  it('shows receipt mutation actions to administrators', () => {
    authState.role = 'admin'
    const { container } = renderModal()
    const receiptRow = within(container.querySelector('.enrollment-billing-receipts'))
      .getByText('水彩')
      .closest('.course-receipt-row')

    expect(within(receiptRow).getByRole('button', { name: '編輯' })).toBeTruthy()
    expect(within(receiptRow).getByRole('button', { name: '刪除' })).toBeTruthy()
  })

  it('does not delete or refresh when permanent deletion is cancelled', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    expect(confirm).toHaveBeenCalledWith('確定刪除此課程的收據？金額與發票編號將無法復原。')
    expect(deleteCourseReceipt).not.toHaveBeenCalled()
    expect(props.onRefresh).not.toHaveBeenCalled()
  })

  it('deletes the confirmed receipt, refreshes, and keeps the modal open', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteCourseReceipt).mockResolvedValue({ receiptId: 100 })
    const { props } = renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    await waitFor(() => {
      expect(deleteCourseReceipt).toHaveBeenCalledWith(expect.anything(), 100)
    })
    expect(await screen.findByText('收據已刪除')).toBeTruthy()
    expect(props.onRefresh).toHaveBeenCalledOnce()
    expect(props.onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('keeps the receipt visible and reports a deletion failure', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteCourseReceipt).mockRejectedValue(new Error('delete denied'))
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    expect((await screen.findByRole('alert')).textContent).toContain('delete denied')
    expect(screen.getByText('R-100')).toBeTruthy()
    expect(screen.getByRole('button', { name: '刪除' })).toBeTruthy()
  })

  it('issues one deletion while the confirmed request is pending', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteCourseReceipt).mockReturnValue(new Promise(() => {}))
    renderModal()

    const deleteButton = screen.getByRole('button', { name: '刪除' })
    fireEvent.click(deleteButton)
    fireEvent.click(deleteButton)

    expect(deleteCourseReceipt).toHaveBeenCalledOnce()
    expect(deleteButton.disabled).toBe(true)
  })

  it('closes an inline editor after deleting that receipt', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.mocked(deleteCourseReceipt).mockResolvedValue({ receiptId: 100 })
    renderModal()

    fireEvent.click(screen.getByRole('button', { name: '編輯' }))
    expect(screen.getByRole('button', { name: '儲存收據' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '刪除' }))

    await screen.findByText('收據已刪除')
    expect(screen.queryByRole('button', { name: '儲存收據' })).toBeNull()
  })

  it('rejects receipt creation when the enrolled course has no valid course ID', async () => {
    renderModal({
      enrollment: {
        ...enrollment,
        courses: ['未識別課程'],
        courseDetails: [{ courseName: '未識別課程', receipt: null }],
      },
    })

    fireEvent.click(screen.getByRole('button', { name: '新增收據' }))
    fireEvent.click(screen.getByRole('button', { name: '未識別課程' }))

    expect((await screen.findByRole('alert')).textContent).toContain('課程資料已更新，請重新載入後再試')
    expect(createCourseReceipt).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '儲存收據' })).toBeNull()
  })

  it('omits empty course context and keeps refund status beside the localized receipt heading', () => {
    const { container } = renderModal({
      enrollment: {
        ...enrollment,
        courses: [],
        courseDetails: [],
      },
    })

    expect(container.querySelector('.enrollment-billing-context')).toBeNull()
    const heading = container.querySelector('.enrollment-billing-heading')
    expect(heading?.querySelector('h3')?.textContent).toBe('課程收據')
    expect(heading?.querySelector('.badge.success')?.textContent).toBe('正常')
  })
})
