import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStudentSelection from './useStudentSelection'

describe('useStudentSelection', () => {
  it('starts with no selected student', () => {
    const { result } = renderHook(() => useStudentSelection([]))
    expect(result.current.selectedStudent).toBeNull()
  })

  it('opens a student in tabbed mode when initialTab is provided', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student, 'profile'))

    expect(result.current.selectedStudent).toEqual(student)
    expect(result.current.studentDetailInitialTab).toBe('profile')
    expect(result.current.studentDetailIsTabbed).toBe(true)
  })

  it('opens a student in stacked mode when initialTab is null', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student))

    expect(result.current.selectedStudent).toEqual(student)
    expect(result.current.studentDetailIsTabbed).toBe(false)
  })

  it('closes the student detail', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student, 'profile'))
    act(() => result.current.closeStudentDetail())

    expect(result.current.selectedStudent).toBeNull()
  })

  it('replaces the selected student after an ID change', () => {
    const original = { student_id: 'S-001', name: 'Ada' }
    const updated = { student_id: '12', name: 'Ada' }
    const { result } = renderHook(() => useStudentSelection([original]))

    act(() => result.current.openStudentDetail(original, 'profile'))
    act(() => result.current.replaceSelectedStudent(updated))

    expect(result.current.selectedStudent).toEqual(updated)
  })

  it('syncs selected student when students list updates', () => {
    const original = { student_id: '1', name: '王小明' }
    const refreshed = { student_id: '1', name: '王大明' }
    const { result, rerender } = renderHook(
      ({ students }) => useStudentSelection(students),
      { initialProps: { students: [original] } }
    )

    act(() => result.current.openStudentDetail(original, 'profile'))
    expect(result.current.selectedStudent.name).toBe('王小明')

    rerender({ students: [refreshed] })
    expect(result.current.selectedStudent.name).toBe('王大明')
  })
})
