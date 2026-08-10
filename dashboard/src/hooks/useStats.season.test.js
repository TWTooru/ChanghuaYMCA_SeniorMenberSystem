import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStats from './useStats'

describe('useStats season metrics', () => {
  it('exposes the latest season and its previous season', () => {
    const { result } = renderHook(() => useStats(
      [{ name: 'A', gender: '男' }, { name: 'B', gender: '女' }],
      [
        { season: '第十五季', reg_type: '新', refunded: false, courses: ['A', 'B'], student_id: '1' },
        { season: '第十六季', reg_type: '續', refunded: false, courses: ['A'], student_id: '1' },
        { season: '第十六季', reg_type: '新', refunded: true, courses: ['C'], student_id: '2' },
      ],
    ))

    expect(result.current.seasonStats).toHaveLength(2)
    expect(result.current.currentSeasonStats).toMatchObject({
      season: result.current.currentSeason,
      enrollments: 2,
      refunds: 1,
      newStudents: 1,
      returningStudents: 1,
    })
    expect(result.current.previousSeasonStats).not.toBeNull()
  })

  it('counts an unrecognised gender as unknown', () => {
    const { result } = renderHook(() => useStats(
      [{ name: 'A', gender: '男' }, { name: 'B', gender: '女' }, { name: 'C', gender: null }],
      [],
    ))

    expect(result.current.genderUnknown).toBe(1)
  })

  it('has no previous season when only one season exists', () => {
    const { result } = renderHook(() => useStats(
      [{ name: 'A', gender: '男' }],
      [{ season: '第十五季', reg_type: '新', refunded: false, courses: ['A'], student_id: '1' }],
    ))

    expect(result.current.currentSeasonStats).not.toBeNull()
    expect(result.current.previousSeasonStats).toBeNull()
  })
})
