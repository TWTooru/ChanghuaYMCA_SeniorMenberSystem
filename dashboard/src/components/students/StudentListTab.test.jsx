import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentListTab from './StudentListTab'

const authState = { role: 'viewer' }
const student = { student_id: 'S-001', name: '王小明', gender: '男' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

describe('StudentListTab add-student access', () => {
  afterEach(cleanup)

  it('hides the add-student button from viewers', () => {
    const { container } = render(
      <StudentListTab
        students={[]}
        enrollments={[]}
        onSelectStudent={vi.fn()}
        onShowAddStudent={vi.fn()}
      />
    )

    expect(container.querySelector('#btn-add-student')).toBeNull()
  })

  it('opens profile from the row and history from the history button', () => {
    const onSelectStudent = vi.fn()
    const { container } = render(
      <StudentListTab students={[student]} enrollments={[]} onSelectStudent={onSelectStudent} onShowAddStudent={vi.fn()} />
    )

    fireEvent.click(container.querySelector('#row-student-S-001'))
    expect(onSelectStudent).toHaveBeenLastCalledWith(student, 'profile')

    fireEvent.click(screen.getByRole('button', { name: '查看歷程' }))
    expect(onSelectStudent).toHaveBeenLastCalledWith(student, 'history')
  })

  it('jumps directly between the first and last student pages', () => {
    const students = Array.from({ length: 21 }, (_, index) => ({
      student_id: `S-${String(index + 1).padStart(3, '0')}`,
      name: `Student ${index + 1}`,
      gender: 'Female'
    }))

    render(
      <StudentListTab
        students={students}
        enrollments={[]}
        onSelectStudent={vi.fn()}
        onShowAddStudent={vi.fn()}
      />
    )

    const firstPageButton = screen.getByRole('button', { name: '跳至最前頁' })
    const lastPageButton = screen.getByRole('button', { name: '跳至最尾頁' })

    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)

    fireEvent.click(lastPageButton)

    expect(screen.getByText('Student 21')).not.toBeNull()
    expect(screen.queryByText('Student 1')).toBeNull()
    expect(firstPageButton.disabled).toBe(false)
    expect(lastPageButton.disabled).toBe(true)

    fireEvent.click(firstPageButton)

    expect(screen.getByText('Student 1')).not.toBeNull()
    expect(screen.queryByText('Student 21')).toBeNull()
    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)
  })
})
