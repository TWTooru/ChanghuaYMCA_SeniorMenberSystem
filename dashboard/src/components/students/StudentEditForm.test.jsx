import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { STUDENT_ID_VALIDATION_MESSAGE } from '../../domain/studentIdentity'
import StudentEditForm from './StudentEditForm'

const { updateStudent } = vi.hoisted(() => ({ updateStudent: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../../services/studentService', () => ({ updateStudent }))

const student = {
  student_id: 1,
  name: '王小明',
  gender: '男',
  education: '高中',
}

afterEach(() => {
  cleanup()
  vi.resetAllMocks()
})

async function selectOption(label, optionName) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  const option = await screen.findByRole('option', { name: optionName, exact: true })
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

function renderForm(overrides = {}) {
  const props = {
    student,
    onSave: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  }
  render(<StudentEditForm {...props} />)
  return props
}

it('requires confirmation before changing the student ID', async () => {
  const updated = { ...student, student_id: 2 }
  updateStudent.mockResolvedValue(updated)
  const { onSave } = renderForm()

  fireEvent.change(screen.getByLabelText('ID'), { target: { value: '0002' } })
  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

  expect(screen.getByText('確認變更 ID')).not.toBeNull()
  expect(updateStudent).not.toHaveBeenCalled()

  fireEvent.click(screen.getByRole('button', { name: '確認變更', exact: true }))

  await waitFor(() => expect(updateStudent).toHaveBeenCalledWith(
    expect.anything(),
    1,
    expect.objectContaining({ student_id: 2 }),
  ))
  expect(updateStudent).toHaveBeenCalledTimes(1)
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(updated))
})

it('keeps the edited ID when its confirmation is cancelled', () => {
  const { onSave } = renderForm()
  fireEvent.change(screen.getByLabelText('ID'), { target: { value: '2' } })
  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
  const confirmation = screen.getByText('確認變更 ID').closest('.form-modal-content')

  fireEvent.click(within(confirmation).getByRole('button', { name: '取消' }))

  expect(updateStudent).not.toHaveBeenCalled()
  expect(screen.getByLabelText('ID').value).toBe('2')
  expect(screen.queryByText('確認變更 ID')).toBeNull()
  expect(onSave).not.toHaveBeenCalled()
})

it('saves a zero-padded original ID without confirmation', async () => {
  const updated = { ...student }
  updateStudent.mockResolvedValue(updated)
  const { onSave } = renderForm()
  fireEvent.change(screen.getByLabelText('ID'), { target: { value: '0001' } })

  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

  expect(screen.queryByText('確認變更 ID')).toBeNull()
  await waitFor(() => expect(updateStudent).toHaveBeenCalledWith(
    expect.anything(),
    1,
    expect.objectContaining({ student_id: 1 }),
  ))
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(updated))
})

it.each(['', '0', '-1'])('rejects invalid student ID %j before calling the service', async invalidId => {
  renderForm()
  fireEvent.change(screen.getByLabelText('ID'), { target: { value: invalidId } })

  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

  expect((await screen.findByRole('alert')).textContent).toContain(STUDENT_ID_VALIDATION_MESSAGE)
  expect(updateStudent).not.toHaveBeenCalled()
})

it('marks profile edits dirty when gender is selected', async () => {
  const onDirtyChange = vi.fn()
  renderForm({ onDirtyChange })

  await selectOption('性別', '女')

  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
})

it('clears dirty state when gender is changed back to its original value', async () => {
  const onDirtyChange = vi.fn()
  renderForm({ onDirtyChange })

  await selectOption('性別', '女')
  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(true))
  await selectOption('性別', '男')

  await waitFor(() => expect(onDirtyChange).toHaveBeenLastCalledWith(false))
})

it('keeps edited data and restores controls when the service rejects', async () => {
  updateStudent.mockRejectedValue(new Error('更新失敗'))
  const { onSave } = renderForm()
  fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王大明' } })

  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

  expect((await screen.findByRole('alert')).textContent).toContain('更新失敗')
  expect(screen.getByDisplayValue('王大明')).not.toBeNull()
  expect(onSave).not.toHaveBeenCalled()
  expect(screen.getByLabelText('ID').disabled).toBe(false)
  expect(screen.getByRole('combobox', { name: '性別' }).disabled).toBe(false)
  expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(false)
  expect(screen.getByRole('button', { name: '儲存變更' }).disabled).toBe(false)
})

it('disables every edit control while saving and reports the resolved student', async () => {
  let resolveUpdate
  const request = new Promise(resolve => { resolveUpdate = resolve })
  const updated = { ...student, name: '王大明' }
  updateStudent.mockReturnValue(request)
  const { onSave } = renderForm()
  fireEvent.change(screen.getByLabelText('姓名'), { target: { value: '王大明' } })

  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

  await waitFor(() => expect(updateStudent).toHaveBeenCalledOnce())
  for (const label of ['ID', '姓名', '電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校']) {
    expect(screen.getByLabelText(label).disabled).toBe(true)
  }
  expect(screen.getByRole('combobox', { name: '性別' }).disabled).toBe(true)
  expect(screen.getByRole('combobox', { name: '教育程度' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '取消' }).disabled).toBe(true)
  expect(screen.getByRole('button', { name: '儲存變更' }).disabled).toBe(true)

  await act(async () => {
    resolveUpdate(updated)
    await request
  })
  await waitFor(() => expect(onSave).toHaveBeenCalledWith(updated))
})
