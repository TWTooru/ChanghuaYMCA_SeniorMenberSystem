import { describe, expect, it } from 'vitest'
import {
  comparePeriods,
  formatPeriod,
  latestPeriod,
  normalizePeriod,
  periodNumber
} from './period'

describe('period domain helpers', () => {
  it('parses and formats period labels with or without Chinese characters', () => {
    expect(periodNumber('第16期')).toBe(16)
    expect(periodNumber('16期')).toBe(16)
    expect(periodNumber('16')).toBe(16)
    expect(formatPeriod(16)).toBe('第16期')
    expect(normalizePeriod('  第16期  ')).toBe('第16期')
    expect(normalizePeriod('  16期  ')).toBe('第16期')
    expect(normalizePeriod('  16  ')).toBe('第16期')
  })

  it('rejects invalid period values', () => {
    for (const invalid of ['第01期', '第0期', '0', '0期', '第十六期', '第16季', 'abc', '']) {
      expect(periodNumber(invalid)).toBe(-1)
      expect(normalizePeriod(invalid)).toBeNull()
    }
  })

  it('compares periods and returns the latest valid period', () => {
    expect(comparePeriods('2', '16期')).toBeLessThan(0)
    expect(comparePeriods('第2期', '第16期')).toBeLessThan(0)
    expect(latestPeriod(['2', '16期', '錯誤'])).toBe('第16期')
  })
})
