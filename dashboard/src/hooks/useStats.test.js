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

  it('aggregates multi-form enrollment stats with partial refunds', () => {
    const enrollments = [
      {
        period: '第16期',
        student_id: 1,
        refunded: false,
        refundStatus: 'partial',
        forms: [
          {
            form_id: 1,
            form_sequence: 1,
            courses: ['A', 'B'],
            refunded: false,
            tuition_fee: 2000,
            materials_fee: 200,
            membership_fee: 100,
            prepaid_amount: 500,
          },
          {
            form_id: 2,
            form_sequence: 2,
            courses: ['C'],
            refunded: true,
            tuition_fee: 1000,
            materials_fee: 100,
            membership_fee: 0,
            prepaid_amount: 200,
          },
        ],
      },
    ]

    const { result } = renderHook(() => useStats([], enrollments))
    expect(result.current.totalRegistrations).toBe(1)
    expect(result.current.totalRefunds).toBe(1)
    expect(result.current.totalRevenue).toBe(2300)
    expect(result.current.totalPrepaid).toBe(500)
    expect(result.current.periodStats[0]).toMatchObject({
      period: '第16期',
      enrollments: 1,
      forms: 2,
      refunds: 1,
      courses: 2,
      revenue: 2300,
      prepaid: 500,
    })
  })
})
