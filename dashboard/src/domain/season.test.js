import { describe, expect, it } from 'vitest'
import {
  compareSeasons,
  formatSeason,
  latestSeason,
  normalizeSeason,
  seasonNumber
} from './season'

describe('season domain helpers', () => {
  it('parses Arabic and Chinese season labels', () => {
    expect(seasonNumber('第16季前測')).toBe(16)
    expect(seasonNumber('第十六季後測')).toBe(16)
    expect(seasonNumber('第十四季14期前')).toBe(14)
    expect(seasonNumber('未知')).toBe(-1)
  })

  it('normalizes valid labels to Chinese 季 terminology', () => {
    expect(normalizeSeason('第十五季')).toBe('第十五季')
    expect(normalizeSeason('第16季前測')).toBe('第十六季')
    expect(normalizeSeason('未知')).toBeNull()
  })

  it('formats supported season numbers', () => {
    expect(formatSeason(21)).toBe('第二十一季')
    expect(formatSeason(0)).toBeNull()
    expect(formatSeason(100)).toBeNull()
    expect(formatSeason(1.5)).toBeNull()
  })

  it('sorts season labels by numeric season order', () => {
    expect(['第十六季', '第二季', '第十五季'].sort(compareSeasons))
      .toEqual(['第二季', '第十五季', '第十六季'])
  })

  it('returns the latest valid season label', () => {
    expect(latestSeason(['未知', '第十五季', '第十六季'])).toBe('第十六季')
    expect(latestSeason(['未知'])).toBeNull()
  })
})

describe('parseChineseNumber edge cases', () => {
  it.each([
    ['第十一季', 11],
    ['第十五季', 15],
    ['第二十季', 20],
    ['第二十一季', 21],
    ['第三十季', 30],
    ['第三十九季', 39],
  ])('seasonNumber("%s") returns %s', (input, expected) => {
    expect(seasonNumber(input)).toBe(expected)
  })
})

describe('compareSeasons ordering', () => {
  it('sorts seasons in chronological order including double-digit seasons', () => {
    const seasons = [
      '第二十一季', '第三季', '第十五季', '第一季',
      '第十季', '第二季', '第二十季', '第九季',
    ]
    const sorted = [...seasons].sort(compareSeasons)
    expect(sorted).toEqual([
      '第一季', '第二季', '第三季', '第九季',
      '第十季', '第十五季', '第二十季', '第二十一季',
    ])
  })
})

describe('normalizeSeason edge cases', () => {
  it.each([
    ['第20季', '第二十季'],
    ['第21季', '第二十一季'],
    ['第15季', '第十五季'],
  ])('normalizeSeason("%s") returns "%s"', (input, expected) => {
    expect(normalizeSeason(input)).toBe(expected)
  })
})

