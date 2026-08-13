import { describe, expect, it } from 'vitest'
import {
  comparePeriods,
  formatPeriod,
  latestPeriod,
  normalizePeriod,
  periodNumber
} from './period'

describe('period domain helpers', () => {
  it('parses and formats strict period labels', () => {
    expect(periodNumber('第16期')).toBe(16)
    expect(formatPeriod(16)).toBe('第16期')
    expect(normalizePeriod('  第16期  ')).toBe('第16期')
  })

  it('rejects labels outside the strict period format', () => {
    for (const invalid of ['第01期', '第0期', '第十六期', '第16季', '16', '']) {
      expect(periodNumber(invalid)).toBe(-1)
      expect(normalizePeriod(invalid)).toBeNull()
    }
  })

  it('compares periods and returns the latest valid period', () => {
    expect(comparePeriods('第2期', '第16期')).toBeLessThan(0)
    expect(latestPeriod(['第2期', '第16期', '錯誤'])).toBe('第16期')
  })
})
