import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_ENROLLMENT_ERROR_MESSAGES } from '../../domain/initialEnrollment'
import AddStudentModal from './AddStudentModal'
import StudentFilters from './StudentFilters'

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

async function selectOption(label, optionName) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  const option = await screen.findByRole('option', { name: optionName, exact: true })
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

const completeProfile = async () => {
  fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
  await selectOption('性別', '男')
  await selectOption('教育程度', '高中')
}

const goToEnrollment = async () => {
  await completeProfile()
  fireEvent.click(screen.getByRole('button', { name: '下一步' }))
}

const completeEnrollment = ({ course = true } = {}) => {
  fireEvent.change(screen.getByLabelText('期別'), { target: { value: '16' } })
  fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-09-01' } })
  fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-31' } })
  if (course) fireEvent.click(screen.getByRole('button', { name: '選擇瑜珈基礎' }))
}

const submitForm = () => fireEvent.click(screen.getByRole('button', { name: '新增會員並報名' }))

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

  it('keeps the profile gender control labelled when student filters are behind the dialog', () => {
    render(<>
      <StudentFilters
        studentSearch=""
        onSearchChange={vi.fn()}
        studentGenderFilter=""
        onGenderChange={vi.fn()}
        studentEduFilter=""
        onEduChange={vi.fn()}
        permissions={{ canAddStudent: true }}
        onShowAddStudent={vi.fn()}
      />
      <AddStudentModal onClose={vi.fn()} onRefresh={vi.fn()} />
    </>)

    expect(within(screen.getByRole('dialog')).getByRole('combobox', { name: '性別' })).not.toBeNull()
  })

  it('closes when Escape is pressed while the dialog is open', () => {
    const { onClose } = renderModal()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps the wizard open when Escape dismisses a profile select', async () => {
    const { onClose } = renderModal()
    const trigger = screen.getByRole('combobox', { name: '性別' })
    fireEvent.click(trigger)
    const option = await screen.findByRole('option', { name: '男', exact: true })
    fireEvent.keyDown(option, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('步驟 1 / 2')).not.toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('blocks missing gender after replacing the native select', () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByRole('alert').textContent).toBe('請完整填寫姓名與性別')
    expect(screen.getByText('步驟 1 / 2')).not.toBeNull()
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('moves to step 2 and displays enrollment fields with the login account', async () => {
    renderModal()
    await goToEnrollment()

    expect(screen.getByText('步驟 2 / 2')).not.toBeNull()
    for (const label of ['期別', '開始日期', '結束日期', '預繳金額', '預繳 No.', '學費', '教材費', '會友費', '正式收據 No.', '備註', '經手人姓名', '登入帳號（自動帶入）', '報到日期']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
    expect(screen.getByLabelText('登入帳號（自動帶入）').value).toBe('editor@example.com')
    expect(screen.getByLabelText('登入帳號（自動帶入）').readOnly).toBe(true)
  })

  it('preserves profile and enrollment values when navigating between steps', async () => {
    renderModal()
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
    await selectOption('性別', '男')
    await selectOption('教育程度', '高中')
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2400' } })
    fireEvent.change(screen.getByLabelText('備註'), { target: { value: '保留測試資料' } })
    fireEvent.click(screen.getByRole('button', { name: '上一步' }))

    expect(screen.getByLabelText('姓名').value).toBe('王小明')
    expect(screen.getByRole('combobox', { name: '性別' }).textContent).toContain('男')
    expect(screen.getByRole('combobox', { name: '教育程度' }).textContent).toContain('高中')

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    expect(screen.getByLabelText('開始日期').value).toBe('2026-09-01')
    expect(screen.getByLabelText('結束日期').value).toBe('2026-12-31')
    expect(screen.getByLabelText('學費').value).toBe('2400')
    expect(screen.getByLabelText('備註').value).toBe('保留測試資料')
  })

  it('shows an email-format error from the visible next button and stays on step 1', async () => {
    renderModal()
    await completeProfile()
    fireEvent.change(screen.getByLabelText('電子郵件'), { target: { value: 'not-an-email' } })
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByRole('alert').textContent).toBe('電子郵件格式不正確')
    expect(screen.getByText('步驟 1 / 2')).not.toBeNull()
    expect(screen.queryByLabelText('期別')).toBeNull()
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the missing-date error and does not call the service', async () => {
    renderModal()
    await goToEnrollment()
    fireEvent.change(screen.getByLabelText('期別'), { target: { value: '16' } })
    fireEvent.click(screen.getByRole('button', { name: '選擇瑜珈基礎' }))
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.datesRequired)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the reversed-date error and does not call the service', async () => {
    renderModal()
    await goToEnrollment()
    completeEnrollment()
    fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-09-01' } })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.dateOrder)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the no-course error and does not call the service', async () => {
    renderModal()
    await goToEnrollment()
    completeEnrollment({ course: false })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.courses)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('shows the invalid-amount error and does not call the service', async () => {
    renderModal()
    await goToEnrollment()
    completeEnrollment()
    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '-1' } })
    submitForm()

    expect(screen.getByRole('alert').textContent).toBe(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
    expect(createStudentWithInitialEnrollment).not.toHaveBeenCalled()
  })

  it('submits normalized student and enrollment payloads without actor fields', async () => {
    createStudentWithInitialEnrollment.mockResolvedValue({ student_id: 1, enrollment_id: 2 })
    renderModal()
    await goToEnrollment()
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

  it('submits with only name and gender when education is blank', async () => {
    createStudentWithInitialEnrollment.mockResolvedValue({ student_id: 1, enrollment_id: 2 })
    renderModal()
    fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王小明' } })
    await selectOption('性別', '男')
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    completeEnrollment()
    submitForm()

    await waitFor(() => expect(createStudentWithInitialEnrollment).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ name: '王小明', gender: '男', education: null }),
      expect.anything(),
    ))
  })

  it('prevents duplicate submit while pending and disables controls', async () => {
    let resolveRequest
    createStudentWithInitialEnrollment.mockImplementation(() => new Promise(resolve => { resolveRequest = resolve }))
    const { onClose } = renderModal()
    await goToEnrollment()
    completeEnrollment()
    const submit = screen.getByRole('button', { name: '新增會員並報名' })
    fireEvent.click(submit)
    fireEvent.click(submit)

    expect(createStudentWithInitialEnrollment).toHaveBeenCalledTimes(1)
    expect(submit.disabled).toBe(true)
    expect(screen.getByRole('button', { name: '上一步' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(true)
    expect(screen.getByLabelText('關閉新增會員').disabled).toBe(true)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    fireEvent.click(screen.getByLabelText('關閉新增會員'))
    expect(onClose).not.toHaveBeenCalled()

    resolveRequest({ student_id: 1, enrollment_id: 2 })
    await waitFor(() => expect(submit.disabled).toBe(false))
  })

  it('keeps the dialog open and shows a rejection message without callbacks', async () => {
    createStudentWithInitialEnrollment.mockRejectedValue(new Error('送出失敗'))
    const { onClose, onRefresh } = renderModal()
    await goToEnrollment()
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
    await goToEnrollment()
    completeEnrollment()
    fireEvent.click(screen.getByRole('button', { name: '新增會員並報名' }))

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
