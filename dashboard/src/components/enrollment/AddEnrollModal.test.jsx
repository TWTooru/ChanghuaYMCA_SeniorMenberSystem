import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddEnrollModal from './AddEnrollModal'
import { createEnrollmentWithCourses } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({ createEnrollmentWithCourses: vi.fn() }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'admin@example.com' } }),
}))

vi.mock('./CourseTagPicker', () => ({
  default: ({ selectedCourseNames, onChange, disabled }) => (
    <section aria-label="course picker">
      {['Course A', 'Course B', 'Course C'].map(courseName => (
        <button
          key={courseName}
          type="button"
          disabled={disabled}
          aria-pressed={selectedCourseNames.includes(courseName)}
          onClick={() => onChange(
            selectedCourseNames.includes(courseName)
              ? selectedCourseNames.filter(name => name !== courseName)
              : [...selectedCourseNames, courseName],
          )}
        >
          {courseName}
        </button>
      ))}
    </section>
  ),
}))

const student = { student_id: 'S-001', name: '王小明' }

function renderModal(props = {}) {
  const onClose = vi.fn()
  const onRefresh = vi.fn()
  const result = render(
    <AddEnrollModal student={student} onClose={onClose} onRefresh={onRefresh} {...props} />,
  )
  return { ...result, onClose, onRefresh }
}

function selectCourse(courseName = 'Course A') {
  fireEvent.click(screen.getByRole('button', { name: courseName }))
}

describe('AddEnrollModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('marks the enrollment form for scoped field-card styling', () => {
    const { container } = renderModal()

    expect(container.querySelector('form.add-enrollment-form')).toBeTruthy()
  })

  it('submits enrollment with paper-form billing details', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    const { onClose, onRefresh } = renderModal({ defaultPeriod: '第16期' })

    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse('Course A')
    selectCourse('Course B')
    fireEvent.change(screen.getByLabelText('預繳金額'), { target: { value: '500' } })
    fireEvent.change(screen.getByLabelText('預繳 No.'), { target: { value: 'P-1' } })
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2400' } })
    fireEvent.change(screen.getByLabelText('教材費'), { target: { value: '300' } })
    fireEvent.change(screen.getByLabelText('會友費'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('正式收據 No.'), { target: { value: 'F-1' } })
    fireEvent.change(screen.getByLabelText('經手人姓名'), { target: { value: '經手人' } })
    fireEvent.change(screen.getByLabelText('辦理日期'), { target: { value: '2026-08-18' } })
    fireEvent.change(screen.getByLabelText('備註'), { target: { value: '備註說明' } })

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      courses: ['Course A', 'Course B'],
      prepaid_amount: '500',
      prepaid_receipt_number: 'P-1',
      tuition_fee: '2400',
      materials_fee: '300',
      membership_fee: '100',
      fee_receipt_number: 'F-1',
      handled_by_name: '經手人',
      handled_on: '2026-08-18',
      notes: '備註說明',
    })
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('creates an enrollment with minimal required fields', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    renderModal({ defaultPeriod: '第16期' })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse()

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      period: '第16期',
      courses: ['Course A'],
    })
  })

  it('guards repeated submissions while the service request is pending', async () => {
    let resolveRequest
    createEnrollmentWithCourses.mockImplementation(() => new Promise(resolve => {
      resolveRequest = resolve
    }))
    const { onClose, onRefresh } = renderModal({ defaultPeriod: '第16期' })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse()
    const form = screen.getByRole('button', { name: '新增選課' }).closest('form')

    fireEvent.submit(form)
    fireEvent.submit(form)

    expect(createEnrollmentWithCourses).toHaveBeenCalledOnce()
    expect(screen.getByRole('button', { name: '新增選課' }).disabled).toBe(true)
    await act(async () => resolveRequest({ enrollment_id: '42' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
    expect(onRefresh).toHaveBeenCalledOnce()
  })

  it('does not close through overlay, Escape, close, or cancel while submitting', async () => {
    createEnrollmentWithCourses.mockImplementation(() => new Promise(() => {}))
    const { onClose } = renderModal({ defaultPeriod: '第16期' })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse()
    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))
    await waitFor(() => expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(true))

    const dialog = screen.getByRole('dialog', { name: '新增選課紀錄' })
    fireEvent.click(dialog.parentElement)
    fireEvent.keyDown(dialog, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '關閉新增選課' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(onClose).not.toHaveBeenCalled()
  })

  it('disables every editable enrollment control while submitting', async () => {
    createEnrollmentWithCourses.mockImplementation(() => new Promise(() => {}))
    renderModal({ defaultPeriod: '第16期' })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse()
    fireEvent.click(screen.getByLabelText('是否已退費'))

    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))
    await waitFor(() => expect(screen.getByRole('button', { name: '新增選課' }).disabled).toBe(true))

    expect(screen.getByRole('button', { name: 'Course A' }).disabled).toBe(true)
    expect(screen.getByLabelText('修課期別 *').disabled).toBe(true)
    expect(screen.getByLabelText('新/續生').disabled).toBe(true)
    expect(screen.getByLabelText('開始日期 *').disabled).toBe(true)
    expect(screen.getByLabelText('結束日期 *').disabled).toBe(true)
    expect(screen.getByLabelText('是否已退費').disabled).toBe(true)
    expect(screen.getByPlaceholderText('例如: 因身體不適退費').disabled).toBe(true)
    expect(screen.getByLabelText('學費').disabled).toBe(true)
    expect(screen.getByLabelText('正式收據 No.').disabled).toBe(true)
  })

  it('closes with Escape while idle', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(screen.getByRole('dialog', { name: '新增選課紀錄' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows a service failure inline and preserves entered values', async () => {
    createEnrollmentWithCourses.mockRejectedValueOnce(new Error('選課建立失敗'))
    const { onClose, onRefresh } = renderModal({ defaultPeriod: '第16期' })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse()
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '3000' } })
    fireEvent.change(screen.getByLabelText('正式收據 No.'), { target: { value: 'R-1' } })

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    expect((await screen.findByRole('alert')).textContent).toContain('選課建立失敗')
    expect(screen.getByLabelText('學費').value).toBe('3000')
    expect(screen.getByLabelText('正式收據 No.').value).toBe('R-1')
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('initializes the period field from the supplied default', () => {
    renderModal({ defaultPeriod: '第16期' })

    expect(screen.getByLabelText('修課期別 *').value).toBe('第16期')
  })

  it('associates every enrollment field label with a stable control ID', () => {
    renderModal()

    const expectedFields = [
      ['學員姓名', 'add-enrollment-student-name'],
      ['學員 ID', 'add-enrollment-student-id'],
      ['修課期別 *', 'add-enrollment-period'],
      ['新/續生', 'add-enrollment-registration-type'],
      ['開始日期 *', 'add-enrollment-start-date'],
      ['結束日期 *', 'add-enrollment-end-date'],
      ['預繳金額', 'add-enrollment-prepaid-amount'],
      ['預繳 No.', 'add-enrollment-prepaid-no'],
      ['學費', 'add-enrollment-tuition-fee'],
      ['教材費', 'add-enrollment-materials-fee'],
      ['會友費', 'add-enrollment-membership-fee'],
      ['正式收據 No.', 'add-enrollment-fee-no'],
      ['是否已退費', 'add-enrollment-refunded'],
      ['備註', 'add-enrollment-notes'],
      ['經手人姓名', 'add-enrollment-handled-by'],
      ['登入帳號（自動帶入）', 'add-enrollment-account'],
      ['辦理日期', 'add-enrollment-handled-on'],
    ]

    expectedFields.forEach(([label, id]) => {
      expect(screen.getByLabelText(label).id).toBe(id)
    })

    fireEvent.click(screen.getByLabelText('是否已退費'))
    expect(screen.getByLabelText('退費原因/備註').id).toBe('add-enrollment-refund-notes')
  })

  it('exposes an accessible close control and traps keyboard focus', () => {
    renderModal()
    const dialog = screen.getByRole('dialog', { name: '新增選課紀錄' })
    const close = screen.getByRole('button', { name: '關閉新增選課' })
    const submit = screen.getByRole('button', { name: '新增選課' })

    expect(dialog.getAttribute('aria-describedby')).toBe('add-enrollment-description')
    expect(document.getElementById('add-enrollment-description').textContent).toContain('新增選課紀錄表單')
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(submit)
    fireEvent.keyDown(submit, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('restores focus to the opener when unmounted', () => {
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const { unmount } = renderModal()

    unmount()

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
