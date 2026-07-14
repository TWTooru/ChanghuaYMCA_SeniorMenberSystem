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

    await act(async () => { await result.current.invite('new@example.com', 'editor') })

    expect(inviteUser).toHaveBeenCalledWith('new@example.com', 'editor')
    expect(result.current.users).toEqual([{ id: 'u1', email: 'new@example.com' }])
    expect(result.current.mutation).toBeNull()
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
})
