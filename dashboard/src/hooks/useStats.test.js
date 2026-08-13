import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStats from './useStats'

describe('useStats', () => {
  it('returns the final education and binary gender distributions', () => {
    const { result } = renderHook(() => useStats([
      { gender: '男', education: '高中' },
      { gender: '女', education: '專科/大學' },
      { gender: '女', education: '專科/大學' },
    ], [{ student_id: 1, period: '第16期', refunded: false, courses: ['A'] }]))

    expect(result.current.educationCounts).toEqual([
      { label: '國中以下', value: 0 }, { label: '高中', value: 1 },
      { label: '專科/大學', value: 2 }, { label: '研究所', value: 0 },
    ])
    expect(result.current.genderCounts).toEqual([{ label: '男', value: 1 }, { label: '女', value: 2 }])
    expect(result.current.currentPeriod).toBe('第16期')
  })
})
