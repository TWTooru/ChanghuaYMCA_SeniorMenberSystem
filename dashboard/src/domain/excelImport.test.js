import { describe, expect, it } from 'vitest'
import { cleanCourseName, cleanDate, cleanInt, cleanScore, cleanStr, extractSeasonNum } from './excelImport'

describe('excel import helpers', () => {
  it('cleans primitive cell values', () => {
    expect(cleanStr('  王小明  ')).toBe('王小明')
    expect(cleanStr(null)).toBeNull()
    expect(cleanInt('42.8')).toBe(42)
    expect(cleanInt('abc')).toBeNull()
  })

  it('converts Excel serial and slash dates to ISO-like dates', () => {
    expect(cleanDate(45292)).toBe('2024-01-01')
    expect(cleanDate('2024/02/03')).toBe('2024-02-03')
    expect(cleanDate('2024-02-03 00:00:00')).toBe('2024-02-03')
  })

  it('cleans test score cells without converting scores to dates', () => {
    expect(cleanScore('80.0')).toBe('80')
    expect(cleanScore(' 67 ')).toBe('67')
    expect(cleanScore('2021-11-04 00:00:00')).toBe('2021/11/04')
    expect(cleanScore(null)).toBeNull()
  })

  it('filters invalid course header and timestamp cells', () => {
    expect(cleanCourseName('Unnamed: 3')).toBeNull()
    expect(cleanCourseName('2024-10-22 00:00:00')).toBeNull()
    expect(cleanCourseName('肌力訓練')).toBe('肌力訓練')
  })

  it('extracts Chinese season numbers', () => {
    expect(extractSeasonNum('第十五期退費')).toBe(15)
    expect(extractSeasonNum('第3季')).toBe(3)
    expect(extractSeasonNum('未知')).toBe(-1)
  })
})
