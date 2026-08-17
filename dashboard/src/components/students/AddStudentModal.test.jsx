import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_ENROLLMENT_ERROR_MESSAGES } from '../../domain/initialEnrollment'
import AddStudentModal from './AddStudentModal'

const { createStudentWithInitialEnrollment } = vi.hoisted(() => ({
  createStudentWithInitialEnrollment: vi.fn(),
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { email: 'editor@example.com' } }),
}))
vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../../services/studentService', () => ({ createStudentWithInitialEnrollment }))
vi.mock('../enrollment/CourseTagPicker', () => ({
  default: ({ onChange, disabled }) => <button type="button" disabled={disabled} onClick={() => onChange(['瑜珈基礎'])}>選擇瑜珈基礎</button>,
}))

const renderModal = (props = {}) => {
  const onClose = vi.fn()
  const onRefresh = vi.fn()
  render(<AddStudentModal onClose={onClose} onRefresh={onRefresh} {...props} />)
  return { onClose, onRefresh }
}

const completeProfile = () => {
  fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
  fireEvent.change(screen.getByLabelText('性別'), { target: { value: '男' } })
  fireEvent.change(screen.getByLabelText('教育程度'), { target: { value: '高中' } })
}

const goToEnrollment = () => {
  completeProfile()
  fireEvent.click(screen.getByRole('button', { name: '下一步' }))
}

const completeEnrollment = ({ course = true } = {}) => {
  fireEvent.change(screen.getByLabelText('期別'), { target: { value: '第16期' } })
  fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-09-01' } })
  fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-31' } })
  if (course) fireEvent.click(screen.getByRole('button', { name: '選擇瑜珈基礎' }))
}

const submitForm = () => fireEvent.submit(screen.getByRole('button', { name: '新增會員並報名' }).form)

describe('AddStudentModal', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('starts at step 1 with member fields but no enrollment fields', () => {
    renderModal()

    expect(screen.getByText('步驟 1 / 2')).not.toBeNull()
    expect(screen.getByLabelText('姓名')).not.toBeNull()
    expect(screen.queryByLabelText('期別')).toBeNull()
  })

  it('moves to step 2 and displays enrollment fields with the login account', () => {
    renderModal()
    goToEnrollment()

    expect(screen.getByText('步驟 2 / 2')).not.toBeNull()
    for (const label of ['期別', '開始日期', '結束日期', '預繳金額', '預繳 No.', '學費', '教材費', '會友費', '正式收據 No.', '備註', '經手人姓名', '登入帳號（自動帶入）', '辦理日期']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
    expect(screen.getByLabelText('登入帳號（自動帶入）').value).toBe('editor@example.com')
    expect(screen.getByLabelText('登入帳號（自動帶入）').readOnly).toBe(true)
  })

  it('preserves profile values when navigating forward then back', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
    fireEvent.change(screen.getByLabelText('性別'), { target: { value: '男' } })
    fireEvent.change(screen.getByLabelText('教育程度'), { target: { value: '高中' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '上一步' }))

    expect(screen.getByLabelText('姓名').value).toBe('王小明')
  })

  it('shows the missing-date error and does not call the service', () => {
    renderModal()
    goToEnrollment()
    fireEvent.change(screen.getByLabelText('期別'), { target: { value: '第16期' } })
    fireEvent.click(screen.getByRole('button', { name: '選擇瑜珈基礎' }))
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.datesRequired)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the reversed-date error and does not call the service', () => {
    renderModal()
    goToEnrollment()
    completeEnrollment()
    fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-09-01' } })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.dateOrder)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the no-course error and does not call the service', () => {
    renderModal()
    goToEnrollment()
    completeEnrollment({ course: false })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.courses)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the invalid-amount error and does not call the service', () => {
    renderModal()
    goToEnrollment()
    completeEnrollment()
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '-1' } })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('submits normalized student and enrollment payloads without actor fields', async () => {
    createStudentWithInitialEnrollment.mockResolvedValue({ student_id: 1, enrollment_id: 2 })
    renderModal()
    goToEnrollment()
    completeEnrollment()
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2400' } })
    fireEvent.click(screen.getByRole('button', { name: '新增會員並報名' }))

    await waitFor(() => expect(createStudentWithInitialEnrollment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: '王小明', gender: '男', education: '高中', student_id: null }),
      expect.objectContaining({
        period: '第16期', period_start_date: '2026-09-01', period_end_date: '2026-12-31',
        courses: ['瑜珈基礎'], tuition_fee: 2400,
      }),
    ))
    const [, studentPayload, enrollmentPayload] = createStudentWithInitialEnrollment.mock.calls[0]
    expect(studentPayload).not.toHaveProperty('handled_by_user_id')
    expect(studentPayload).not.toHaveProperty('handled_by_account')
    expect(enrollmentPayload).not.toHaveProperty('handled_by_user_id')
    expect(enrollmentPayload).not.toHaveProperty('handled_by_account')
  })

  it('prevents duplicate submit while pending and disables controls', async () => {
    let resolveRequest
    createStudentWithInitialEnrollment.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve }))
    renderModal()
    goToEnrollment()
    completeEnrollment()
    const submit = screen.getByRole('button', { name: '新增會員並報名' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(createStudentWithInitialEnrollment).toHaveBeenCalledTimes(1)
    expect(submit.disabled).toBe(true)
    expect(screen.getByRole('button', { name: '上一步' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(true)
    expect(screen.getByLabelText('關閉新增會員').disabled).toBe(true)

    resolveRequest({ student_id: 1, enrollment_id: 2 })
    await waitFor(() => expect(submit.disabled).toBe(false))
  })

  it('keeps the dialog open and shows a rejection message without callbacks', async () => {
    createStudentWithInitialEnrollment.mockRejectedValue(new Error('送出失敗'))
    const { onClose, onRefresh } = renderModal()
    goToEnrollment()
    completeEnrollment()
    fireEvent.click(screen.getByRole('button', { name: '新增會員並報名' }))

    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('送出失敗'))
    expect(screen.getByRole('dialog')).not.toBeNull()
    expect(onRefresh).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('refreshes and closes exactly once after a successful submission', async () => {
    createStudentWithInitialEnrollment.mockResolvedValue({ student_id: 1, enrollment_id: 2 })
    const { onClose, onRefresh } = renderModal()
    goToEnrollment()
    completeEnrollment()
    fireEvent.click(screen.getByRole('button', { name: '新增會員並報名' }))

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
