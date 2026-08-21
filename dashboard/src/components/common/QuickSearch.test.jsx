import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import QuickSearch from './QuickSearch'

const students = [
  { student_id: 101, name: '王小明', mobile_phone: '0912-345-678' },
  { student_id: 'A-202', name: '陳美玲', mobile_phone: '0988-000-111' },
]

afterEach(cleanup)

describe('QuickSearch', () => {
  it.each([
    ['101', '王小明'],
    ['陳美玲', '陳美玲'],
    ['0912', '王小明'],
  ])('finds target-schema students with %s', (query, expected) => {
    render(<QuickSearch students={students} onSelect={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } })

    expect(screen.getByRole('option', { name: new RegExp(expected) })).toBeTruthy()
  })

  it('selects the highlighted result with arrows and Enter', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    render(<QuickSearch students={students} onSelect={onSelect} onClose={onClose} />)
    const input = screen.getByRole('searchbox')

    fireEvent.change(input, { target: { value: '0' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onSelect).toHaveBeenCalledWith(students[1])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders an accessible dialog and no-results message', () => {
    render(<QuickSearch students={students} onSelect={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'missing' } })

    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(screen.getByText('找不到符合的學生')).toBeTruthy()
  })

  it('caps search results at ten', () => {
    const manyStudents = Array.from({ length: 11 }, (_, index) => ({
      student_id: `S-${index + 1}`,
      name: `Student ${index + 1}`,
      mobile_phone: null,
    }))
    render(<QuickSearch students={manyStudents} onSelect={vi.fn()} onClose={vi.fn()} />)

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Student' } })

    expect(screen.getAllByRole('option', { name: /Student/ })).toHaveLength(10)
  })

  it('closes with Escape and restores focus to the trigger', () => {
    const onClose = vi.fn()
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    render(<QuickSearch students={students} onSelect={vi.fn()} onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledOnce()
    cleanup()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })
})
