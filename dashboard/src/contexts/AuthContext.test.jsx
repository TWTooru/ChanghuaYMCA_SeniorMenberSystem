import { describe, it, expect } from 'vitest'
import { extractRole } from './AuthContext'

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
