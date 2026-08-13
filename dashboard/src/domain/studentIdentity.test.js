import { describe, expect, it } from 'vitest'
import { buildStudentIdentityKey, normalizeEmail, normalizePhoneForIdentity, normalizeStudentId } from './studentIdentity'

describe('member identity helpers', () => {
  it('normalizes a positive numeric member ID', () => {
    expect(normalizeStudentId('0007')).toBe(7)
    expect(normalizeStudentId(' 42 ')).toBe(42)
    expect(normalizeStudentId('', { allowBlank: true })).toBeNull()
  })

  it.each(['', '0', '-1', '1.5', 'member-1'])(
    'rejects an invalid member ID: %s',
    value => expect(() => normalizeStudentId(value)).toThrow()
  )

  it('normalizes emails and phones for matching without altering display data', () => {
    expect(normalizeEmail(' Member@Example.COM ')).toBe('member@example.com')
    expect(normalizeEmail('  ')).toBeNull()
    expect(normalizePhoneForIdentity('0912-345-678')).toBe('0912345678')
  })

  it('uses name, phone, and birth date for the fallback identity', () => {
    expect(buildStudentIdentityKey({ name: ' 王小明 ', phone: '0912-345-678', birth_date: '1980-07-01' }))
      .toBe(JSON.stringify(['王小明', '0912345678', '1980/07/01']))
    expect(buildStudentIdentityKey({ name: '王小明', phone: '', birth_date: '1980-07-01' })).toBeNull()
  })
})
