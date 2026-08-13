import { describe, expect, it } from 'vitest'
import { detectPasswordFlow } from './authFlow'

describe('detectPasswordFlow', () => {
  it('recognizes a Supabase invite callback from the URL fragment', () => {
    expect(detectPasswordFlow({
      pathname: '/',
      search: '',
      hash: '#access_token=invite-token&refresh_token=refresh-token&type=invite',
    })).toBe('invite')
  })

  it('does not treat a normal hash with type=invite as an auth callback', () => {
    expect(detectPasswordFlow({ pathname: '/', search: '', hash: '#type=invite' })).toBeNull()
  })
})
