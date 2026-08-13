import { describe, expect, it } from 'vitest'
import { EDUCATION_OPTIONS, normalizeEducation } from './studentFields'

describe('member profile field helpers', () => {
  it('accepts only the four approved education values', () => {
    expect(EDUCATION_OPTIONS).toEqual(['國中以下', '高中', '專科/大學', '研究所'])
    expect(normalizeEducation(' 專科/大學 ')).toBe('專科/大學')
    expect(normalizeEducation('博士')).toBeNull()
    expect(normalizeEducation('')).toBeNull()
  })
})
