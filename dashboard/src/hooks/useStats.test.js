import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStats from './useStats'

describe('useStats', () => {
  it('returns empty stats when students is empty', () => {
    const { result } = renderHook(() => useStats([], []))
    expect(result.current.totalStudents).toBe(0)
    expect(result.current.popularCourses).toEqual([])
  })

  it('computes gender counts', () => {
    const students = [
      { name: 'A', gender: '男', age: 65 },
      { name: 'B', gender: '女', age: 70 },
      { name: 'C', gender: '男', age: 55 },
    ]
    const { result } = renderHook(() => useStats(students, []))
    expect(result.current.males).toBe(2)
    expect(result.current.females).toBe(1)
  })

  it('computes age groups', () => {
    const students = [
      { name: 'A', age: 45 },
      { name: 'B', age: 65 },
      { name: 'C', age: null },
    ]
    const { result } = renderHook(() => useStats(students, []))
    expect(result.current.ageGroups['50歲以下']).toBe(1)
    expect(result.current.ageGroups['60-69歲']).toBe(1)
    expect(result.current.ageGroups['未知']).toBe(1)
  })

  it('computes popular courses excluding refunded', () => {
    const students = [{ name: 'A' }]
    const enrollments = [
      { refunded: false, courses: ['肌力訓練', '北歐健走'] },
      { refunded: true, courses: ['肌力訓練'] },
      { refunded: false, courses: ['肌力訓練'] },
    ]
    const { result } = renderHook(() => useStats(students, enrollments))
    expect(result.current.popularCourses[0]).toEqual({ name: '肌力訓練', count: 2 })
    expect(result.current.popularCourses[1]).toEqual({ name: '北歐健走', count: 1 })
  })
})
