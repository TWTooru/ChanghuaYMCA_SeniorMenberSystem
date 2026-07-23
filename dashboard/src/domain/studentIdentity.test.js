import { describe, expect, it } from 'vitest'
import {
  STUDENT_ID_VALIDATION_MESSAGE,
  buildStudentIdentityKey,
  normalizeIdentityDate,
  normalizeStudentId,
} from './studentIdentity'

describe('student identity domain', () => {
  it('normalizes positive integer IDs without Number coercion', () => {
    expect(normalizeStudentId(' 0012 ')).toBe('12')
    expect(normalizeStudentId('900719925474099312345')).toBe('900719925474099312345')
    expect(normalizeStudentId('', { allowBlank: true })).toBeNull()
  })

  it.each(['', '0', '000', '-1', '1.5', 'A12', '12A'])(
    'rejects invalid student ID %s',
    value => {
      expect(() => normalizeStudentId(value)).toThrow(STUDENT_ID_VALIDATION_MESSAGE)
    }
  )

  it('requires matching trimmed name, gender, and birth date for a strict identity key', () => {
    expect(buildStudentIdentityKey({
      name: ' Ada ',
      gender: ' F ',
      birth_date: '1960-1-2',
      mobile_phone: '0912345678',
    })).toBe(JSON.stringify(['Ada', 'F', '1960/01/02']))
    expect(buildStudentIdentityKey({ name: 'Ada', gender: '', birth_date: '1960/01/02' })).toBeNull()
    expect(buildStudentIdentityKey({ name: 'Ada', gender: 'F', birth_date: '' })).toBeNull()
  })

  it('normalizes supported stored date separators', () => {
    expect(normalizeIdentityDate('1960-1-2')).toBe('1960/01/02')
    expect(normalizeIdentityDate('1960/01/02')).toBe('1960/01/02')
    expect(normalizeIdentityDate('1960/02/30')).toBe('')
  })
})
