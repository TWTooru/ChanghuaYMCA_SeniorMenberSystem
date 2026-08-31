import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AddStudentModal from './AddStudentModal'
import { createStudent } from '../../services/studentService'

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
}))

vi.mock('../../services/studentService', () => ({
  createStudent: vi.fn(),
}))

describe('AddStudentModal', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('does not dismiss when its outer overlay is clicked', () => {
    const onClose = vi.fn()
    render(<AddStudentModal students={[]} onClose={onClose} />)

    fireEvent.click(document.querySelector('#modal-add-student-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('closes when Escape is pressed while the dialog is open', () => {
    const onClose = vi.fn()
    render(<AddStudentModal students={[]} onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the close button or cancel button is clicked', () => {
    const onClose = vi.fn()
    render(<AddStudentModal students={[]} onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(document.getElementById('btn-close-add-student'))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('automatically suggests the next numeric student ID', () => {
    render(<AddStudentModal students={[{ student_id: '1' }, { student_id: '5' }]} onClose={vi.fn()} />)

    expect(screen.getByLabelText(/學員 ID/).value).toBe('6')
  })

  it('estimates age from birth date', () => {
    render(<AddStudentModal students={[]} onClose={vi.fn()} />)

    const birthInput = screen.getByLabelText('出生日期')
    const currentYear = new Date().getFullYear()
    fireEvent.change(birthInput, { target: { value: `${currentYear - 30}-05-15` } })

    expect(screen.getByLabelText(/年齡/).value).toBe('30')
  })

  it('submits form successfully and calls onRefresh and onClose', async () => {
    createStudent.mockResolvedValueOnce()
    const onClose = vi.fn()
    const onRefresh = vi.fn()
    vi.spyOn(window, 'alert').mockImplementation(() => {})

    render(<AddStudentModal students={[{ student_id: '1' }]} onClose={onClose} onRefresh={onRefresh} />)

    fireEvent.change(screen.getByLabelText(/姓名/), { target: { value: '王大明' } })
    fireEvent.click(screen.getByRole('button', { name: '新增學員' }))

    await waitFor(() => {
      expect(createStudent).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          student_id: '2',
          name: '王大明',
          gender: '男',
        })
      )
      expect(onRefresh).toHaveBeenCalledTimes(1)
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })
})
