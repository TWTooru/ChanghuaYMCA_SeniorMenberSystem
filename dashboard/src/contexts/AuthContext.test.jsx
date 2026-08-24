import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, detectPasswordFlow, useAuth } from './AuthContext'

const supabaseMocks = vi.hoisted(() => ({
  authCallback: null,
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  from: vi.fn(),
  roleRequests: [],
}))

vi.mock('../lib/supabaseClient', () => ({
  initialPasswordFlow: null,
  supabase: {
    auth: {
      getSession: supabaseMocks.getSession,
      onAuthStateChange: supabaseMocks.onAuthStateChange,
      signOut: supabaseMocks.signOut,
    },
    from: supabaseMocks.from,
  },
}))

const createDeferred = () => {
  let resolve
  let reject
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

const createSession = (id, metadata = {}) => ({
  access_token: `access-${id}`,
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 1_800_000_000,
  refresh_token: `refresh-${id}`,
  user: {
    id,
    aud: 'authenticated',
    email: `${id}@example.com`,
    app_metadata: metadata.app_metadata ?? {},
    user_metadata: metadata.user_metadata ?? {},
    created_at: '2026-08-24T00:00:00.000Z',
  },
})

const storedRole = (role) => ({ data: { role }, error: null })
const missingRole = () => ({ data: null, error: null })
const storeError = () => ({
  data: null,
  error: { code: '42501', message: 'database detail must stay private' },
})

const enqueueRoleRequest = (resultOrPromise) => {
  supabaseMocks.roleRequests.push(Promise.resolve(resultOrPromise))
}

function AuthProbe({ onValue }) {
  const auth = useAuth()
  onValue(auth)
  return <output data-testid="auth-probe">{auth.user?.id ?? 'signed-out'}</output>
}

const renderProvider = () => {
  let latest = null
  const rendered = render(
    <AuthProvider>
      <AuthProbe onValue={(value) => { latest = value }} />
    </AuthProvider>,
  )

  return {
    ...rendered,
    current: () => latest,
  }
}

const emitAuthEvent = (event, session) => {
  act(() => {
    supabaseMocks.authCallback(event, session)
  })
}

describe('AuthProvider stored role lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    supabaseMocks.authCallback = null
    supabaseMocks.roleRequests = []
    supabaseMocks.getSession.mockResolvedValue({ data: { session: null }, error: null })
    supabaseMocks.signOut.mockResolvedValue({ error: null })
    supabaseMocks.onAuthStateChange.mockImplementation((callback) => {
      supabaseMocks.authCallback = callback
      return { data: { subscription: { unsubscribe: supabaseMocks.unsubscribe } } }
    })
    supabaseMocks.from.mockImplementation(() => {
      const request = supabaseMocks.roleRequests.shift()
      if (!request) throw new Error('Unexpected app_user_roles request')
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => request,
          }),
        }),
      }
    })
    window.history.replaceState({}, '', '/')
  })

  afterEach(cleanup)

  it('finishes signed out with cleared fail-closed role state', async () => {
    const view = renderProvider()

    await screen.findByTestId('auth-probe')

    expect(view.current()).toMatchObject({
      session: null,
      user: null,
      role: null,
      roleStatus: 'unassigned',
      roleErrorCode: null,
      loading: false,
    })
    expect(supabaseMocks.from).not.toHaveBeenCalled()
  })

  it('keeps children blocked through both session and role loading', async () => {
    const sessionRequest = createDeferred()
    const roleRequest = createDeferred()
    supabaseMocks.getSession.mockReturnValue(sessionRequest.promise)
    enqueueRoleRequest(roleRequest.promise)

    renderProvider()
    expect(screen.queryByTestId('auth-probe')).toBeNull()

    await act(async () => {
      sessionRequest.resolve({ data: { session: createSession('user-a') }, error: null })
    })
    await waitFor(() => expect(supabaseMocks.from).toHaveBeenCalledOnce())
    expect(screen.queryByTestId('auth-probe')).toBeNull()

    await act(async () => {
      roleRequest.resolve(storedRole('editor'))
    })
    expect((await screen.findByTestId('auth-probe')).textContent).toBe('user-a')
  })

  it('uses a ready owner row despite conflicting app and user metadata', async () => {
    const session = createSession('owner-user', {
      app_metadata: { app_role: 'viewer', role: 'editor' },
      user_metadata: { role: 'admin' },
    })
    supabaseMocks.getSession.mockResolvedValue({ data: { session }, error: null })
    enqueueRoleRequest(storedRole('owner'))

    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    expect(view.current()).toMatchObject({
      session,
      user: session.user,
      role: 'owner',
      roleStatus: 'ready',
      roleErrorCode: null,
      loading: false,
    })
  })

  it('marks a missing stored row as unassigned without a viewer fallback', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('missing-user', { user_metadata: { role: 'admin' } }) },
      error: null,
    })
    enqueueRoleRequest(missingRole())

    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    expect(view.current()).toMatchObject({
      role: null,
      roleStatus: 'unassigned',
      roleErrorCode: 'ROLE_NOT_ASSIGNED',
      loading: false,
    })
  })

  it('maps store failures to a private stable error state', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('error-user') },
      error: null,
    })
    enqueueRoleRequest(storeError())

    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    expect(view.current()).toMatchObject({
      role: null,
      roleStatus: 'error',
      roleErrorCode: 'ROLE_STORE_ERROR',
      loading: false,
    })
  })

  it('retries the current user role and awaits the successful result', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('retry-user') },
      error: null,
    })
    enqueueRoleRequest(missingRole())

    const view = renderProvider()
    await screen.findByTestId('auth-probe')
    expect(view.current().roleStatus).toBe('unassigned')

    enqueueRoleRequest(storedRole('admin'))
    let result
    await act(async () => {
      result = await view.current().refreshRole()
    })

    expect(result).toBe('admin')
    expect(view.current()).toMatchObject({
      role: 'admin',
      roleStatus: 'ready',
      roleErrorCode: null,
      loading: false,
    })
  })

  it.each(['TOKEN_REFRESHED', 'USER_UPDATED'])(
    'clears access and rereads the stored role on %s',
    async (event) => {
      const initialSession = createSession('event-user')
      supabaseMocks.getSession.mockResolvedValue({ data: { session: initialSession }, error: null })
      enqueueRoleRequest(storedRole('viewer'))

      const view = renderProvider()
      await screen.findByTestId('auth-probe')
      expect(view.current().role).toBe('viewer')

      const refreshedRole = createDeferred()
      enqueueRoleRequest(refreshedRole.promise)
      emitAuthEvent(event, createSession('event-user', { app_metadata: { role: 'owner' } }))
      expect(screen.queryByTestId('auth-probe')).toBeNull()

      await act(async () => {
        refreshedRole.resolve(storedRole('editor'))
      })
      await screen.findByTestId('auth-probe')
      expect(view.current()).toMatchObject({ role: 'editor', roleStatus: 'ready' })
    },
  )

  it('does not let an older slow lookup overwrite a newer signed-in session', async () => {
    const olderRole = createDeferred()
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('older-user') },
      error: null,
    })
    enqueueRoleRequest(olderRole.promise)

    const view = renderProvider()
    await waitFor(() => expect(supabaseMocks.from).toHaveBeenCalledOnce())

    enqueueRoleRequest(storedRole('editor'))
    emitAuthEvent('SIGNED_IN', createSession('newer-user'))
    await screen.findByTestId('auth-probe')
    expect(view.current()).toMatchObject({
      user: expect.objectContaining({ id: 'newer-user' }),
      role: 'editor',
      roleStatus: 'ready',
    })

    await act(async () => {
      olderRole.resolve(storedRole('owner'))
    })
    expect(view.current()).toMatchObject({
      user: expect.objectContaining({ id: 'newer-user' }),
      role: 'editor',
      roleStatus: 'ready',
    })
  })

  it('does not let an older rejected lookup replace a newer ready session with an error', async () => {
    const olderRole = createDeferred()
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('older-error-user') },
      error: null,
    })
    enqueueRoleRequest(olderRole.promise)

    const view = renderProvider()
    await waitFor(() => expect(supabaseMocks.from).toHaveBeenCalledOnce())

    enqueueRoleRequest(storedRole('admin'))
    emitAuthEvent('SIGNED_IN', createSession('newer-ready-user'))
    await screen.findByTestId('auth-probe')
    expect(view.current()).toMatchObject({
      user: expect.objectContaining({ id: 'newer-ready-user' }),
      role: 'admin',
      roleStatus: 'ready',
      roleErrorCode: null,
      loading: false,
    })

    await act(async () => {
      olderRole.reject(new Error('stale store failure'))
      await Promise.resolve()
    })
    expect(view.current()).toMatchObject({
      user: expect.objectContaining({ id: 'newer-ready-user' }),
      role: 'admin',
      roleStatus: 'ready',
      roleErrorCode: null,
      loading: false,
    })
  })

  it('does not let an older lookup restore a role after an auth sign-out event', async () => {
    const olderRole = createDeferred()
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('signout-user') },
      error: null,
    })
    enqueueRoleRequest(olderRole.promise)

    const view = renderProvider()
    await waitFor(() => expect(supabaseMocks.from).toHaveBeenCalledOnce())

    emitAuthEvent('SIGNED_OUT', null)
    await screen.findByTestId('auth-probe')
    expect(view.current()).toMatchObject({
      session: null,
      user: null,
      role: null,
      roleStatus: 'unassigned',
    })

    await act(async () => {
      olderRole.resolve(storedRole('owner'))
    })
    expect(view.current()).toMatchObject({
      session: null,
      user: null,
      role: null,
      roleStatus: 'unassigned',
    })
  })

  it('clears the local role immediately when signOut is called', async () => {
    const remoteSignOut = createDeferred()
    supabaseMocks.signOut.mockReturnValue(remoteSignOut.promise)
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('local-signout-user') },
      error: null,
    })
    enqueueRoleRequest(storedRole('admin'))

    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    let signOutPromise
    act(() => {
      signOutPromise = view.current().signOut()
    })
    expect(view.current()).toMatchObject({
      session: null,
      user: null,
      role: null,
      roleStatus: 'unassigned',
      loading: false,
    })
    expect(supabaseMocks.signOut).toHaveBeenCalledOnce()

    await act(async () => {
      remoteSignOut.resolve({ error: null })
      await signOutPromise
    })
  })

  it('unsubscribes and ignores pending work and callbacks after unmount', async () => {
    supabaseMocks.getSession.mockResolvedValue({
      data: { session: createSession('mounted-user') },
      error: null,
    })
    enqueueRoleRequest(storedRole('viewer'))

    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    const pendingRole = createDeferred()
    enqueueRoleRequest(pendingRole.promise)
    emitAuthEvent('TOKEN_REFRESHED', createSession('mounted-user'))
    expect(supabaseMocks.from).toHaveBeenCalledTimes(2)

    view.unmount()
    expect(supabaseMocks.unsubscribe).toHaveBeenCalledOnce()

    emitAuthEvent('USER_UPDATED', createSession('post-unmount-user'))
    expect(supabaseMocks.from).toHaveBeenCalledTimes(2)

    await act(async () => {
      pendingRole.resolve(storedRole('owner'))
    })
  })

  it('preserves password recovery state and completion URL cleanup', async () => {
    const view = renderProvider()
    await screen.findByTestId('auth-probe')

    window.history.replaceState({}, '', '/set-password?flow=recovery')
    enqueueRoleRequest(storedRole('viewer'))
    emitAuthEvent('PASSWORD_RECOVERY', createSession('recovery-user'))
    await screen.findByTestId('auth-probe')
    expect(view.current().passwordFlow).toBe('recovery')

    act(() => {
      view.current().completePasswordFlow()
    })
    expect(view.current().passwordFlow).toBeNull()
    expect(window.location.pathname).toBe('/')
    expect(window.location.search).toBe('')
  })
})

describe('detectPasswordFlow', () => {
  it('recognizes invite setup links', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=invite' })).toBe('invite')
  })

  it('recognizes invite setup links in subdirectories', () => {
    expect(detectPasswordFlow({
      pathname: '/YMCA_SocialEducationMenberSystem/set-password',
      search: '?flow=invite',
    })).toBe('invite')
  })

  it('recognizes Supabase invite callbacks from the URL fragment', () => {
    expect(detectPasswordFlow({
      pathname: '/',
      search: '',
      hash: '#access_token=invite-token&refresh_token=refresh-token&type=invite',
    })).toBe('invite')
  })

  it('ignores invite-like fragments that are not Supabase auth callbacks', () => {
    expect(detectPasswordFlow({ pathname: '/', search: '', hash: '#type=invite' })).toBeNull()
  })

  it('recognizes recovery setup links', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=recovery' })).toBe('recovery')
  })

  it('recognizes recovery setup links in subdirectories', () => {
    expect(detectPasswordFlow({
      pathname: '/YMCA_SocialEducationMenberSystem/set-password',
      search: '?flow=recovery',
    })).toBe('recovery')
  })

  it('ignores normal application URLs', () => {
    expect(detectPasswordFlow({ pathname: '/', search: '' })).toBeNull()
    expect(detectPasswordFlow({ pathname: '/YMCA_SocialEducationMenberSystem/', search: '' })).toBeNull()
  })

  it('ignores unknown password flows', () => {
    expect(detectPasswordFlow({ pathname: '/set-password', search: '?flow=unknown' })).toBeNull()
    expect(detectPasswordFlow({ pathname: '/YMCA_SocialEducationMenberSystem/set-password', search: '?flow=unknown' })).toBeNull()
  })
})
