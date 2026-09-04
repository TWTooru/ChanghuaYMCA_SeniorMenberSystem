import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AdminUserError,
  deleteUser,
  inviteUser,
  listAuditLogs,
  listUsers,
  resendInvite,
  sendPasswordReset,
  updateRole,
} from '../services/adminUserService'
import useAdminUsers from './useAdminUsers'

vi.mock('../services/adminUserService', () => ({
  AdminUserError: class AdminUserError extends Error {
    constructor(code) {
      super(code)
      this.code = code
    }
  },
  deleteUser: vi.fn(),
  inviteUser: vi.fn(),
  listAuditLogs: vi.fn(),
  listUsers: vi.fn(),
  resendInvite: vi.fn(),
  sendPasswordReset: vi.fn(),
  updateRole: vi.fn(),
}))

describe('useAdminUsers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('loads users and audit logs in parallel on mount', async () => {
    let resolveUsers
    let resolveAuditLogs
    listUsers.mockReturnValueOnce(new Promise(resolve => { resolveUsers = resolve }))
    listAuditLogs.mockReturnValueOnce(new Promise(resolve => { resolveAuditLogs = resolve }))

    const { result } = renderHook(() => useAdminUsers())

    expect(result.current.loading).toBe(true)
    expect(listUsers).toHaveBeenCalledOnce()
    expect(listAuditLogs).toHaveBeenCalledOnce()

    await act(async () => {
      resolveUsers({ users: [{ id: 'u1' }] })
      resolveAuditLogs({ auditLogs: [{ id: 'a1' }] })
    })

    expect(result.current.users).toEqual([{ id: 'u1' }])
    expect(result.current.auditLogs).toEqual([{ id: 'a1' }])
    expect(result.current.loading).toBe(false)
  })

  it('replaces loaded data on refresh', async () => {
    listUsers
      .mockResolvedValueOnce({ users: [{ id: 'u1' }] })
      .mockResolvedValueOnce({ users: [{ id: 'u2' }] })
    listAuditLogs
      .mockResolvedValueOnce({ auditLogs: [{ id: 'a1' }] })
      .mockResolvedValueOnce({ auditLogs: [{ id: 'a2' }] })

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'u1' }]))

    await act(async () => { await result.current.refresh() })

    expect(result.current.users).toEqual([{ id: 'u2' }])
    expect(result.current.auditLogs).toEqual([{ id: 'a2' }])
  })

  it('refreshes after inviting and clears the mutation state', async () => {
    listUsers
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({ users: [{ id: 'u1', email: 'new@example.com' }] })
    listAuditLogs.mockResolvedValue({ auditLogs: [] })
    inviteUser.mockResolvedValueOnce({ user: { id: 'u1' } })

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => { await result.current.invite('new@example.com') })

    expect(inviteUser).toHaveBeenCalledWith('new@example.com')
    expect(result.current.users).toEqual([{ id: 'u1', email: 'new@example.com' }])
    expect(result.current.mutation).toBeNull()
  })

  it('replaces a changed role with the server user summary immediately without reloading the list', async () => {
    const existingUser = { id: 'u1', email: 'member@example.com', role: 'viewer', status: 'active' }
    const serverSummary = { id: 'u1', email: 'member@example.com', role: 'editor', status: 'active' }
    listUsers.mockResolvedValueOnce({ users: [existingUser] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'a1' }] })
    updateRole.mockResolvedValueOnce({ user: serverSummary })

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([existingUser]))

    await act(async () => {
      await expect(result.current.changeRole('u1', 'editor')).resolves.toBe(true)
    })

    expect(result.current.users).toEqual([serverSummary])
    expect(result.current.auditLogs).toEqual([{ id: 'a1' }])
    expect(listUsers).toHaveBeenCalledOnce()
    expect(listAuditLogs).toHaveBeenCalledOnce()
  })

  it('returns false when a mutation fails after recording its stable error code', async () => {
    listUsers.mockResolvedValue({ users: [] })
    listAuditLogs.mockResolvedValue({ auditLogs: [] })
    inviteUser.mockRejectedValueOnce(new AdminUserError('USER_EXISTS'))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.invite('exists@example.com')).resolves.toBe(false)
    })
    expect(result.current.errorCode).toBe('USER_EXISTS')
  })

  it('clears sensitive data when refresh becomes forbidden', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'u1' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'a1' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toHaveLength(1))

    listUsers.mockRejectedValueOnce(new AdminUserError('FORBIDDEN'))
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [] })
    await act(async () => { await result.current.refresh() })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
    expect(result.current.errorCode).toBe('FORBIDDEN')
  })

  it.each(['ROLE_NOT_ASSIGNED', 'ROLE_STORE_ERROR', 'FORBIDDEN', 'UNAUTHENTICATED'])(
    'clears the cached list immediately when a mutation fails with sensitive code %s',
    async errorCode => {
      listUsers.mockResolvedValueOnce({ users: [{ id: 'u1' }] })
      listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'a1' }] })
      inviteUser.mockRejectedValueOnce(new AdminUserError(errorCode))
      const { result } = renderHook(() => useAdminUsers())
      await waitFor(() => expect(result.current.users).toEqual([{ id: 'u1' }]))

      await act(async () => {
        await expect(result.current.invite('member@example.com')).resolves.toBe(false)
      })

      expect(result.current.users).toEqual([])
      expect(result.current.auditLogs).toEqual([])
      expect(result.current.errorCode).toBe(errorCode)
    },
  )

  it.each(['OWNER_PROTECTED', 'ADMIN_TARGET_FORBIDDEN', 'OWNER_REQUIRED'])(
    'keeps the authorized list when a target-specific mutation fails with %s',
    async errorCode => {
      const users = [{ id: 'u1', role: 'admin' }]
      const auditLogs = [{ id: 'a1' }]
      listUsers.mockResolvedValueOnce({ users })
      listAuditLogs.mockResolvedValueOnce({ auditLogs })
      deleteUser.mockRejectedValueOnce(new AdminUserError(errorCode))
      const { result } = renderHook(() => useAdminUsers())
      await waitFor(() => expect(result.current.users).toEqual(users))

      await act(async () => {
        await expect(result.current.remove('u1', 'member@example.com')).resolves.toBe(false)
      })

      expect(result.current.users).toEqual(users)
      expect(result.current.auditLogs).toEqual(auditLogs)
      expect(result.current.errorCode).toBe(errorCode)
    },
  )

  it('keeps loaded account data after LAST_OWNER_REQUIRED', async () => {
    const users = [{ id: 'owner-2', role: 'owner' }]
    const auditLogs = [{ id: 'audit-1' }]
    listUsers.mockResolvedValue({ users })
    listAuditLogs.mockResolvedValue({ auditLogs })
    updateRole.mockRejectedValueOnce(new AdminUserError('LAST_OWNER_REQUIRED'))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await expect(result.current.changeRole('owner-2', 'admin')).resolves.toBe(false)
    })

    expect(result.current.errorCode).toBe('LAST_OWNER_REQUIRED')
    expect(result.current.users).toEqual(users)
    expect(result.current.auditLogs).toEqual(auditLogs)
  })

  it('keeps the cache cleared when an older list response resolves after a role-store failure', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let resolveOlderUsers
    let resolveOlderAuditLogs
    listUsers.mockReturnValueOnce(new Promise(resolve => { resolveOlderUsers = resolve }))
    listAuditLogs.mockReturnValueOnce(new Promise(resolve => { resolveOlderAuditLogs = resolve }))
    inviteUser.mockRejectedValueOnce(new AdminUserError('ROLE_STORE_ERROR'))

    let olderRefresh
    await act(async () => { olderRefresh = result.current.refresh() })
    await act(async () => { await result.current.invite('member@example.com') })
    expect(result.current.users).toEqual([])
    expect(result.current.loading).toBe(false)

    await act(async () => {
      resolveOlderUsers({ users: [{ id: 'stale' }] })
      resolveOlderAuditLogs({ auditLogs: [{ id: 'stale-log' }] })
      await olderRefresh
    })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
    expect(result.current.errorCode).toBe('ROLE_STORE_ERROR')
    expect(result.current.loading).toBe(false)
  })

  it('does not let an older mutation repopulate the cache after a sensitive failure', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial', role: 'viewer' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial', role: 'viewer' }]))

    let resolveOlderRoleChange
    updateRole.mockReturnValueOnce(new Promise(resolve => { resolveOlderRoleChange = resolve }))
    resendInvite.mockRejectedValueOnce(new AdminUserError('ROLE_NOT_ASSIGNED'))

    let olderMutation
    await act(async () => { olderMutation = result.current.changeRole('initial', 'editor') })
    await act(async () => { await result.current.resend('other') })
    expect(result.current.users).toEqual([])

    await act(async () => {
      resolveOlderRoleChange({ user: { id: 'initial', role: 'editor' } })
      await expect(olderMutation).resolves.toBe(false)
    })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
    expect(listUsers).toHaveBeenCalledOnce()
  })

  it('invalidates a pending mutation on unmount so its response cannot trigger a reload', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'u1', role: 'viewer' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [] })
    let resolveRoleChange
    updateRole.mockReturnValueOnce(new Promise(resolve => { resolveRoleChange = resolve }))

    const { result, unmount } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'u1', role: 'viewer' }]))

    let pendingMutation
    await act(async () => { pendingMutation = result.current.changeRole('u1', 'editor') })
    unmount()
    resolveRoleChange({ user: { id: 'u1', role: 'editor' } })

    await expect(pendingMutation).resolves.toBe(false)
    expect(listUsers).toHaveBeenCalledOnce()
  })

  it('invalidates a pending refresh on unmount with an explicit false result', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [] })
    const { result, unmount } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let resolveUsers
    let resolveAuditLogs
    listUsers.mockReturnValueOnce(new Promise(resolve => { resolveUsers = resolve }))
    listAuditLogs.mockReturnValueOnce(new Promise(resolve => { resolveAuditLogs = resolve }))
    let pendingRefresh
    await act(async () => { pendingRefresh = result.current.refresh() })

    unmount()
    resolveUsers({ users: [{ id: 'stale' }] })
    resolveAuditLogs({ auditLogs: [{ id: 'stale-log' }] })

    await expect(pendingRefresh).resolves.toBe(false)
  })

  // 這組案例鎖定授權失效後的競態，避免舊 request 把已清除的帳號資料寫回畫面。
  it('does not restore sensitive data from an older refresh after a forbidden refresh', async () => {
    let resolveOlderUsers
    let resolveOlderAuditLogs
    listUsers
      .mockReturnValueOnce(new Promise(resolve => { resolveOlderUsers = resolve }))
      .mockRejectedValueOnce(new AdminUserError('FORBIDDEN'))
    listAuditLogs
      .mockReturnValueOnce(new Promise(resolve => { resolveOlderAuditLogs = resolve }))
      .mockResolvedValueOnce({ auditLogs: [] })

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(listUsers).toHaveBeenCalledOnce())

    let forbiddenRefresh
    await act(async () => { forbiddenRefresh = result.current.refresh() })
    await act(async () => { await forbiddenRefresh })
    expect(result.current.errorCode).toBe('FORBIDDEN')

    await act(async () => {
      resolveOlderUsers({ users: [{ id: 'u1' }] })
      resolveOlderAuditLogs({ auditLogs: [{ id: 'a1' }] })
    })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
  })

  it('ignores a forbidden error from an older refresh after a newer refresh succeeds', async () => {
    listUsers
      .mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs
      .mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let rejectOlderUsers
    let resolveOlderAuditLogs
    listUsers
      .mockReturnValueOnce(new Promise((_, reject) => { rejectOlderUsers = reject }))
      .mockResolvedValueOnce({ users: [{ id: 'newer' }] })
    listAuditLogs
      .mockReturnValueOnce(new Promise(resolve => { resolveOlderAuditLogs = resolve }))
      .mockResolvedValueOnce({ auditLogs: [{ id: 'newer-log' }] })

    let olderRefresh
    await act(async () => { olderRefresh = result.current.refresh() })
    await act(async () => { await result.current.refresh() })

    await act(async () => {
      rejectOlderUsers(new AdminUserError('FORBIDDEN'))
      resolveOlderAuditLogs({ auditLogs: [] })
      await olderRefresh
    })

    expect(result.current.users).toEqual([{ id: 'newer' }])
    expect(result.current.auditLogs).toEqual([{ id: 'newer-log' }])
    expect(result.current.errorCode).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it.each([
    ['changeRole', 'role:u1', updateRole, ['u1', 'editor']],
    ['resend', 'resend:u1', resendInvite, ['u1']],
    ['resetPassword', 'reset:u1', sendPasswordReset, ['u1']],
    ['remove', 'delete:u1', deleteUser, ['u1', 'admin@example.com']],
  ])('uses the %s mutation key while performing its service action', async (method, key, service, args) => {
    listUsers.mockResolvedValue({ users: [] })
    listAuditLogs.mockResolvedValue({ auditLogs: [] })
    let completeAction
    service.mockReturnValueOnce(new Promise(resolve => { completeAction = resolve }))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let pending
    await act(async () => { pending = result.current[method](...args) })
    expect(result.current.mutation).toBe(key)

    await act(async () => { completeAction({}) })
    await act(async () => { await pending })
    expect(service).toHaveBeenCalledWith(...args)
    expect(result.current.mutation).toBeNull()
  })

  // 這組案例驗證 busy state 跟隨最後一個仍在執行的 mutation，而不是最後一個啟動的 mutation。
  it('keeps the newer mutation state while an earlier mutation finishes', async () => {
    listUsers.mockResolvedValue({ users: [] })
    listAuditLogs.mockResolvedValue({ auditLogs: [] })
    let completeRoleChange
    let completeReset
    updateRole.mockReturnValueOnce(new Promise(resolve => { completeRoleChange = resolve }))
    sendPasswordReset.mockReturnValueOnce(new Promise(resolve => { completeReset = resolve }))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let roleChange
    let reset
    await act(async () => { roleChange = result.current.changeRole('u1', 'editor') })
    await act(async () => { reset = result.current.resetPassword('u2') })
    expect(result.current.mutation).toBe('reset:u2')

    await act(async () => { completeRoleChange({}) })
    await act(async () => { await roleChange })
    expect(result.current.mutation).toBe('reset:u2')

    await act(async () => { completeReset({}) })
    await act(async () => { await reset })
    expect(result.current.mutation).toBeNull()
  })

  it('keeps the older mutation state when a newer mutation finishes first', async () => {
    listUsers.mockResolvedValue({ users: [] })
    listAuditLogs.mockResolvedValue({ auditLogs: [] })
    let completeRoleChange
    let completeReset
    updateRole.mockReturnValueOnce(new Promise(resolve => { completeRoleChange = resolve }))
    sendPasswordReset.mockReturnValueOnce(new Promise(resolve => { completeReset = resolve }))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.loading).toBe(false))

    let roleChange
    let reset
    await act(async () => { roleChange = result.current.changeRole('u1', 'editor') })
    await act(async () => { reset = result.current.resetPassword('u2') })

    await act(async () => { completeReset({}) })
    await act(async () => { await reset })
    expect(result.current.mutation).toBe('role:u1')

    await act(async () => { completeRoleChange({}) })
    await act(async () => { await roleChange })
    expect(result.current.mutation).toBeNull()
  })

  it('ignores a forbidden error from an older mutation after a newer refresh succeeds', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    let rejectRoleChange
    updateRole.mockReturnValueOnce(new Promise((_, reject) => { rejectRoleChange = reject }))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let olderMutation
    await act(async () => { olderMutation = result.current.changeRole('u1', 'editor') })
    listUsers.mockResolvedValueOnce({ users: [{ id: 'newer' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'newer-log' }] })
    await act(async () => { await result.current.refresh() })

    await act(async () => {
      rejectRoleChange(new AdminUserError('UNAUTHENTICATED'))
      await olderMutation
    })

    expect(result.current.users).toEqual([{ id: 'newer' }])
    expect(result.current.auditLogs).toEqual([{ id: 'newer-log' }])
    expect(result.current.errorCode).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('keeps an in-flight refresh when a mutation fails with a non-auth error', async () => {
    let resolveUsers
    let resolveAuditLogs
    listUsers.mockReturnValueOnce(new Promise(resolve => { resolveUsers = resolve }))
    listAuditLogs.mockReturnValueOnce(new Promise(resolve => { resolveAuditLogs = resolve }))
    updateRole.mockRejectedValueOnce(new AdminUserError('INVALID_ROLE'))

    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(listUsers).toHaveBeenCalledOnce())

    await act(async () => { await result.current.changeRole('u1', 'editor') })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      resolveUsers({ users: [{ id: 'u1' }] })
      resolveAuditLogs({ auditLogs: [{ id: 'a1' }] })
    })

    expect(result.current.users).toEqual([{ id: 'u1' }])
    expect(result.current.auditLogs).toEqual([{ id: 'a1' }])
    expect(result.current.loading).toBe(false)
  })

  it('clears sensitive data when the current refresh becomes forbidden while a mutation is pending', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let rejectRefresh
    let completeRoleChange
    listUsers.mockReturnValueOnce(new Promise((_, reject) => { rejectRefresh = reject }))
    listAuditLogs.mockReturnValueOnce(new Promise(() => {}))
    updateRole.mockReturnValueOnce(new Promise(resolve => { completeRoleChange = resolve }))

    let refresh
    let mutation
    await act(async () => { refresh = result.current.refresh() })
    await act(async () => { mutation = result.current.changeRole('u1', 'editor') })
    await act(async () => {
      rejectRefresh(new AdminUserError('FORBIDDEN'))
      await refresh
    })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
    expect(result.current.errorCode).toBe('FORBIDDEN')

    await act(async () => { completeRoleChange({}) })
    await act(async () => { await mutation })
  })

  it('clears sensitive data when an earlier pending mutation becomes forbidden while a newer mutation is pending', async () => {
    listUsers.mockResolvedValueOnce({ users: [{ id: 'initial' }] })
    listAuditLogs.mockResolvedValueOnce({ auditLogs: [{ id: 'initial-log' }] })
    const { result } = renderHook(() => useAdminUsers())
    await waitFor(() => expect(result.current.users).toEqual([{ id: 'initial' }]))

    let rejectFirstMutation
    let rejectSecondMutation
    updateRole.mockReturnValueOnce(new Promise((_, reject) => { rejectFirstMutation = reject }))
    resendInvite.mockReturnValueOnce(new Promise((_, reject) => { rejectSecondMutation = reject }))

    let firstMutation
    let secondMutation
    await act(async () => { firstMutation = result.current.changeRole('u1', 'editor') })
    await act(async () => { secondMutation = result.current.resend('u2') })
    await act(async () => {
      rejectFirstMutation(new AdminUserError('FORBIDDEN'))
      await firstMutation
    })

    expect(result.current.users).toEqual([])
    expect(result.current.auditLogs).toEqual([])
    expect(result.current.errorCode).toBe('FORBIDDEN')

    await act(async () => {
      rejectSecondMutation(new AdminUserError('INVALID_ROLE'))
      await secondMutation
    })
  })
})
