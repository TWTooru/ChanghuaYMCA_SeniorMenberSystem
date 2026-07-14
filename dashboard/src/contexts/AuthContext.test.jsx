import { describe, it, expect } from 'vitest'
import { detectPasswordFlow, extractRole } from './AuthContext'

describe('extractRole', () => {
  it('extracts role from session app_metadata', () => {
    const session = { user: { app_metadata: { app_role: 'admin' } } }
    expect(extractRole(session)).toBe('admin')
  })

  it('defaults to viewer when app_role is missing', () => {
    const session = { user: { app_metadata: {} } }
    expect(extractRole(session)).toBe('viewer')
  })

  it('defaults to viewer when app_metadata is missing', () => {
    const session = { user: {} }
    expect(extractRole(session)).toBe('viewer')
  })

  it('defaults to viewer when session is null', () => {
    expect(extractRole(null)).toBe('viewer')
  })

  it('defaults to viewer when app_role is empty string', () => {
    const session = { user: { app_metadata: { app_role: '' } } }
    expect(extractRole(session)).toBe('viewer')
  })
})

describe('detectPasswordFlow', () => {
  it('recognizes invite setup links', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=invite' })).toBe('invite')
  })

  it('recognizes recovery setup links', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=recovery' })).toBe('recovery')
  })

  it('ignores normal application URLs', () => {
    expect(detectPasswordFlow({ pathname: '/', search: '' })).toBeNull()
  })

  it('ignores unknown password flows', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=unknown' })).toBeNull()
  })
})
