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

  it('computes revenue correctly excluding refunds', () => {
    const enrollments = [
      { period: '第16期', refunded: false, tuition_fee: 1000, materials_fee: 200, membership_fee: 100, prepaid_amount: 50 },
      { period: '第16期', refunded: false, tuition_fee: 500, materials_fee: 0, membership_fee: 0, prepaid_amount: 0 },
      { period: '第16期', refunded: true, tuition_fee: 1000, materials_fee: 200, membership_fee: 100, prepaid_amount: 50 }, // Should be excluded
      { period: '第17期', refunded: false, tuition_fee: 2000, materials_fee: 0, membership_fee: 0, prepaid_amount: 100 },
    ]
    const { result } = renderHook(() => useStats([], enrollments))
    expect(result.current.totalRevenue).toBe(3800)
    expect(result.current.totalPrepaid).toBe(150)
    expect(result.current.periodStats).toEqual([
      expect.objectContaining({ period: '第16期', revenue: 1800, prepaid: 50 }),
      expect.objectContaining({ period: '第17期', revenue: 2000, prepaid: 100 }),
    ])
  })
})
