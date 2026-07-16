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
})
