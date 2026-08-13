import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStats from './useStats'

describe('useStats period summary', () => {
  it('orders periods numerically and exposes the current and previous summary', () => {
    const { result } = renderHook(() => useStats([], [
      { student_id: 1, period: '第2期', refunded: false, courses: ['A'] },
      { student_id: 2, period: '第16期', refunded: true, courses: [] },
    ]))

    expect(result.current.currentPeriod).toBe('第16期')
    expect(result.current.currentPeriodStats).toMatchObject({ period: '第16期', enrollments: 1, refunds: 1 })
    expect(result.current.previousPeriodStats).toMatchObject({ period: '第2期', enrollments: 1 })
  })
})
