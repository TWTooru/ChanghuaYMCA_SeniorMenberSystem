import { describe, expect, it } from 'vitest'
import {
  calculateAgeFromBirthDate,
  formatSixtyPlus,
  normalizeEducation,
  splitCourseNames
} from './studentFields'

describe('student field helpers', () => {
  it('normalizes related education labels into reporting buckets', () => {
    expect(normalizeEducation('大學')).toBe('大專/大學')
    expect(normalizeEducation('未受正規教育但識字')).toBe('未受正規教育但識字')
    expect(normalizeEducation('')).toBe('未知')
  })

  it('calculates age from birth date using the supplied current date', () => {
    expect(calculateAgeFromBirthDate('1960-08-01', new Date('2026-07-08'))).toBe(65)
    expect(calculateAgeFromBirthDate('1960-07-01', new Date('2026-07-08'))).toBe(66)
    expect(calculateAgeFromBirthDate('not-a-date', new Date('2026-07-08'))).toBeNull()
  })

  it('formats the 60 plus flag from parsed age', () => {
    expect(formatSixtyPlus(60)).toBe('是')
    expect(formatSixtyPlus(59)).toBe('否')
    expect(formatSixtyPlus(null)).toBe('否')
  })

  it('splits course names on English and Chinese commas', () => {
    expect(splitCourseNames('活力有氧, 肌力訓練，北歐健走')).toEqual([
      '活力有氧',
      '肌力訓練',
      '北歐健走'
    ])
  })
})
