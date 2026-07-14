import { beforeEach, describe, expect, it, vi } from 'vitest'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke },
  },
}))

import {
  AdminUserError,
  deleteUser,
  inviteUser,
  listAuditLogs,
  listUsers,
  resendInvite,
  sendPasswordReset,
  updateRole,
} from './adminUserService'

describe('adminUserService', () => {
  beforeEach(() => {
    invoke.mockReset()
  })

  it('lists users through the admin Edge Function', async () => {
    const users = [{ id: 'u1' }]
    invoke.mockResolvedValue({ data: { users }, error: null })

    await expect(listUsers()).resolves.toEqual({ users })
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'list_users' },
    })
  })

  it('lists audit logs through the admin Edge Function', async () => {
    invoke.mockResolvedValue({ data: { logs: [] }, error: null })

    await expect(listAuditLogs()).resolves.toEqual({ logs: [] })
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'list_audit_logs' },
    })
  })

  it('invites with normalized email and no client-selected role', async () => {
    invoke.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null })

    await inviteUser(' New@Example.com ')

    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'invite_user', email: 'new@example.com' },
    })
  })

  it('updates a user role', async () => {
    invoke.mockResolvedValue({ data: { user: { id: 'u1', role: 'editor' } }, error: null })

    await updateRole('u1', 'editor')

    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'update_role', userId: 'u1', role: 'editor' },
    })
  })

  it('sends only a user id for server-resolved mail actions', async () => {
    invoke.mockResolvedValue({ data: { sent: true }, error: null })

    await resendInvite('u1')
    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'resend_invite', userId: 'u1' },
    })

    await sendPasswordReset('u1')
    expect(invoke).toHaveBeenLastCalledWith('admin-users', {
      body: { action: 'send_password_reset', userId: 'u1' },
    })
  })

  it('deletes with a normalized confirmation email', async () => {
    invoke.mockResolvedValue({ data: { deleted: true }, error: null })

    await deleteUser('u1', ' Admin@Example.com ')

    expect(invoke).toHaveBeenCalledWith('admin-users', {
      body: { action: 'delete_user', userId: 'u1', confirmEmail: 'admin@example.com' },
    })
  })

  it('maps function error codes to AdminUserError', async () => {
    invoke.mockResolvedValue({
      data: null,
      error: {
        context: { json: vi.fn().mockResolvedValue({ error: { code: 'LAST_ADMIN_PROTECTED' } }) },
      },
    })

    await expect(deleteUser('u1', 'admin@example.com')).rejects.toMatchObject({
      code: 'LAST_ADMIN_PROTECTED',
    })
  })

  it('uses a stable fallback when a function error has no readable body', async () => {
    invoke.mockResolvedValue({ data: null, error: { context: { json: vi.fn().mockRejectedValue(new Error('network')) } } })

    await expect(listUsers()).rejects.toEqual(expect.objectContaining({
      name: 'Error',
      code: 'SUPABASE_AUTH_ERROR',
    }))
    await expect(listUsers()).rejects.toBeInstanceOf(AdminUserError)
  })

  it('maps returned application errors to AdminUserError', async () => {
    invoke.mockResolvedValue({ data: { error: { code: 'FORBIDDEN' } }, error: null })

    await expect(listUsers()).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})
