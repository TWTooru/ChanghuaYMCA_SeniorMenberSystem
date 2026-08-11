import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddEnrollModal from './AddEnrollModal'
import { createEnrollmentWithCourses } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({ createEnrollmentWithCourses: vi.fn() }))

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

function addPayment({ courses = ['Course A'], amount = '3000', invoiceNumber = 'R-1' } = {}) {
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  courses.forEach(courseName => fireEvent.click(screen.getByLabelText(courseName)))
  fireEvent.change(screen.getByLabelText('總金額'), { target: { value: amount } })
  fireEvent.change(screen.getByLabelText('收據編號'), { target: { value: invoiceNumber } })
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

  it('submits one payment covering multiple selected courses', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    const { onClose, onRefresh } = renderModal()

    selectCourse('Course A')
    selectCourse('Course B')
    addPayment({ courses: ['Course A', 'Course B'] })
    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      courses: ['Course A', 'Course B'],
      paymentRecords: [{
        courseNames: ['Course A', 'Course B'],
        amount: '3000',
        invoiceNumber: 'R-1',
      }],
    })
    expect(onRefresh).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('creates an enrollment without a payment record', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    renderModal()
    selectCourse()

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      courses: ['Course A'],
      paymentRecords: [],
    })
  })

  it('reconciles payment assignments when the course selection changes', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    renderModal()
    selectCourse('Course A')
    selectCourse('Course B')
    addPayment({ courses: ['Course A', 'Course B'] })

    selectCourse('Course B')
    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      courses: ['Course A'],
      paymentRecords: [{ courseNames: ['Course A'] }],
    })
  })

  it('rejects an invalid payment amount before calling the service', async () => {
    renderModal()
    selectCourse()
    addPayment({ amount: '-1' })

    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))

    expect((await screen.findByRole('alert')).textContent).toBe('金額必須為 0 或正整數')
    expect(createEnrollmentWithCourses).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('guards repeated submissions while the service request is pending', async () => {
    let resolveRequest
    createEnrollmentWithCourses.mockImplementation(() => new Promise(resolve => {
      resolveRequest = resolve
    }))
    const { onClose, onRefresh } = renderModal()
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
    const { onClose } = renderModal()
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
    renderModal()
    selectCourse()
    fireEvent.click(screen.getByLabelText('是否已退費'))
    addPayment()

    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))
    await waitFor(() => expect(screen.getByRole('button', { name: '新增選課' }).disabled).toBe(true))

    expect(screen.getByRole('button', { name: 'Course A' }).disabled).toBe(true)
    expect(screen.getByLabelText('修課季度 *').disabled).toBe(true)
    expect(screen.getByRole('combobox').disabled).toBe(true)
    screen.getAllByPlaceholderText('(分數)(年/月/日)').forEach(field => expect(field.disabled).toBe(true))
    expect(screen.getByLabelText('是否已退費').disabled).toBe(true)
    expect(screen.getByPlaceholderText('例如: 因身體不適退費').disabled).toBe(true)
    expect(screen.getByLabelText('總金額').disabled).toBe(true)
    expect(screen.getByLabelText('收據編號').disabled).toBe(true)
    expect(screen.getByRole('button', { name: '新增繳費紀錄' }).disabled).toBe(true)
  })

  it('closes with Escape while idle', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(screen.getByRole('dialog', { name: '新增選課紀錄' }), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows a service failure inline and preserves entered payment values', async () => {
    createEnrollmentWithCourses.mockRejectedValueOnce(new Error('付款建立失敗'))
    const { onClose, onRefresh } = renderModal()
    selectCourse()
    addPayment()

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    expect((await screen.findByRole('alert')).textContent).toContain('付款建立失敗')
    expect(screen.getByLabelText('總金額').value).toBe('3000')
    expect(screen.getByLabelText('收據編號').value).toBe('R-1')
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
  })

  it('normalizes a valid manual season label before creating enrollment', async () => {
    createEnrollmentWithCourses.mockResolvedValueOnce({ enrollment_id: '42' })
    renderModal()
    fireEvent.change(screen.getByLabelText('修課季度 *'), { target: { value: '第16期' } })
    selectCourse()

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      season: '第十六季',
      courses: ['Course A'],
    })
  })

  it('initializes the season field from the supplied default', () => {
    renderModal({ defaultSeason: '第十六季' })

    expect(screen.getByLabelText('修課季度 *').value).toBe('第十六季')
  })

  it('associates every enrollment field label with a stable control ID', () => {
    renderModal()

    const expectedFields = [
      ['學員姓名', 'add-enrollment-student-name'],
      ['學員 ID', 'add-enrollment-student-id'],
      ['修課季度 *', 'add-enrollment-season'],
      ['新/續生', 'add-enrollment-registration-type'],
      ['前測分數', 'add-enrollment-pre-test'],
      ['後測分數', 'add-enrollment-post-test'],
      ['是否已退費', 'add-enrollment-refunded'],
    ]

    expectedFields.forEach(([label, id]) => {
      expect(screen.getByLabelText(label).id).toBe(id)
    })

    fireEvent.click(screen.getByLabelText('是否已退費'))
    expect(screen.getByLabelText('退費原因/備註').id).toBe('add-enrollment-refund-notes')
  })

  it('reports invalid form values inline before calling the service', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('修課季度 *'), { target: { value: '春季班' } })
    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))
    expect((await screen.findByRole('alert')).textContent).toContain('請輸入有效的季度')

    fireEvent.change(screen.getByLabelText('修課季度 *'), { target: { value: '第十六季' } })
    fireEvent.submit(screen.getByRole('button', { name: '新增選課' }).closest('form'))
    expect((await screen.findByRole('alert')).textContent).toContain('請至少選擇一門課程')
    expect(createEnrollmentWithCourses).not.toHaveBeenCalled()
    expect(window.alert).not.toHaveBeenCalled()
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
