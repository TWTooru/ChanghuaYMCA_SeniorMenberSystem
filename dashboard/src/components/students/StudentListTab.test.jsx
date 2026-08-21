import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentListTab from './StudentListTab'

const authState = { role: 'viewer' }
const student = { student_id: 'S-001', name: '王小明', gender: '男' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  authState.role = 'viewer'
})

describe('StudentListTab add-student access', () => {
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

describe('StudentListTab list navigation', () => {
  const makeStudents = (count) => Array.from({ length: count }, (_, index) => ({
    student_id: `S-${index + 1}`,
    name: `Student ${index + 1}`,
    gender: 'Female'
  }))

  it('waits 300 ms before applying search input', () => {
    vi.useFakeTimers()
    const { container } = render(<StudentListTab students={[student]} enrollments={[]} onSelectStudent={vi.fn()} />)

    fireEvent.change(container.querySelector('#student-search'), { target: { value: 'No match' } })

    expect(screen.getByText(student.name)).not.toBeNull()
    act(() => vi.advanceTimersByTime(300))
    expect(screen.queryByText(student.name)).toBeNull()
  })

  it('changes page size and returns to the first page', () => {
    render(<StudentListTab students={makeStudents(25)} enrollments={[]} onSelectStudent={vi.fn()} />)

    fireEvent.click(document.getElementById('btn-student-last'))
    fireEvent.change(document.querySelector('.page-size-selector select'), { target: { value: '20' } })

    expect(screen.getByText('Student 1')).not.toBeNull()
    expect(screen.queryByText('Student 21')).toBeNull()
  })

  it('sorts names ascending then descending', () => {
    render(<StudentListTab students={[
      { student_id: 'S-2', name: 'Charlie', gender: 'Female' },
      { student_id: 'S-1', name: 'Alice', gender: 'Female' },
      { student_id: 'S-3', name: 'Bob', gender: 'Female' }
    ]} enrollments={[]} onSelectStudent={vi.fn()} />)

    const nameHeader = document.querySelector('thead th:nth-child(2) button')
    fireEvent.click(nameHeader)
    expect(document.querySelectorAll('tbody tr')).toHaveLength(3)
    expect([...document.querySelectorAll('tbody tr')].map(row => row.cells[1].textContent)).toEqual(['Alice', 'Bob', 'Charlie'])

    fireEvent.click(nameHeader)
    expect([...document.querySelectorAll('tbody tr')].map(row => row.cells[1].textContent)).toEqual(['Charlie', 'Bob', 'Alice'])
  })

  it('sorts student IDs with numeric ordering', () => {
    render(<StudentListTab students={[
      { student_id: 'S-10', name: 'Ten', gender: 'Female' },
      { student_id: 'S-2', name: 'Two', gender: 'Female' },
      { student_id: 'S-1', name: 'One', gender: 'Female' }
    ]} enrollments={[]} onSelectStudent={vi.fn()} />)

    expect([...document.querySelectorAll('tbody tr')].map(row => row.cells[0].textContent)).toEqual(['S-1', 'S-2', 'S-10'])
  })

  it('clamps an out-of-range page after search filtering', () => {
    vi.useFakeTimers()
    const { container } = render(<StudentListTab students={makeStudents(21)} enrollments={[]} onSelectStudent={vi.fn()} />)

    fireEvent.click(document.getElementById('btn-student-last'))
    expect(screen.getByText('Student 21')).not.toBeNull()

    fireEvent.change(container.querySelector('#student-search'), { target: { value: 'Student 1' } })
    act(() => vi.advanceTimersByTime(300))

    expect(screen.getByText('Student 1')).not.toBeNull()
    expect(document.getElementById('btn-student-first').disabled).toBe(true)
  })

  it('keeps the admin merge dialog available', () => {
    authState.role = 'admin'
    const { container } = render(<StudentListTab students={[student]} enrollments={[]} onSelectStudent={vi.fn()} />)

    fireEvent.click(container.querySelector('.btn-primary'))
    expect(screen.getByRole('dialog')).not.toBeNull()

  })
})
