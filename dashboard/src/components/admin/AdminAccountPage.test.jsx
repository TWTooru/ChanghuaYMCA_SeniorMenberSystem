import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountPage from './AdminAccountPage'
import { useAuth } from '../../contexts/AuthContext'
import useAdminUsers from '../../hooks/useAdminUsers'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../hooks/useAdminUsers', () => ({ default: vi.fn() }))

const authState = { role: 'admin', user: { id: 'admin-1', email: 'admin@example.com' } }
const adminState = {
  users: [
    { id: 'admin-1', email: 'admin@example.com', role: 'admin', status: 'active' },
    { id: 'u2', email: 'invitee@example.com', role: 'viewer', status: 'invited' },
    { id: 'u3', email: 'member@example.com', role: 'editor', status: 'active' },
  ],
  auditLogs: [{ id: 'audit-1', action: 'invite_user', status: 'success', actorEmail: 'admin@example.com', targetEmail: 'old@example.com', oldRole: null, newRole: 'viewer', createdAt: '2026-07-14T00:00:00.000Z' }],
  loading: false,
  mutation: null,
  errorCode: null,
  invite: vi.fn(),
  changeRole: vi.fn(),
  resend: vi.fn(),
  resetPassword: vi.fn(),
  remove: vi.fn(),
}

describe('AdminAccountPage', () => {
  afterEach(cleanup)
  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = 'admin'
    authState.user = { id: 'admin-1', email: 'admin@example.com' }
    adminState.users = [
      { id: 'admin-1', email: 'admin@example.com', role: 'admin', status: 'active' },
      { id: 'u2', email: 'invitee@example.com', role: 'viewer', status: 'invited' },
      { id: 'u3', email: 'member@example.com', role: 'editor', status: 'active' },
    ]
    adminState.auditLogs = [{ id: 'audit-1', action: 'invite_user', status: 'success', actorEmail: 'admin@example.com', targetEmail: 'old@example.com', oldRole: null, newRole: 'viewer', createdAt: '2026-07-14T00:00:00.000Z' }]
    adminState.loading = false
    adminState.mutation = null
    adminState.errorCode = null
    adminState.invite.mockResolvedValue(true)
    adminState.changeRole.mockResolvedValue(true)
    adminState.resend.mockResolvedValue(true)
    adminState.resetPassword.mockResolvedValue(true)
    adminState.remove.mockResolvedValue(true)
    useAuth.mockImplementation(() => authState)
    useAdminUsers.mockImplementation(() => adminState)
  })

  it('does not load or render account data for a non-admin', () => {
    authState.role = 'editor'
    render(<AdminAccountPage />)
    expect(screen.getByText('您沒有帳號管理權限')).toBeTruthy()
    expect(useAdminUsers).not.toHaveBeenCalled()
  })

  it('requires exact target email before permanent delete', () => {
    render(<AdminAccountPage />)
    fireEvent.click(screen.getByLabelText('刪除 member@example.com'))
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: 'wrong@example.com' } })
    expect(screen.getByRole('button', { name: '永久刪除' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: ' MEMBER@example.com ' } })
    expect(screen.getByRole('button', { name: '永久刪除' }).disabled).toBe(false)
  })

  it('disables self mutation and last-admin mutation', () => {
    authState.user = { id: 'self', email: 'self@example.com' }
    adminState.users = [{ id: 'self', email: 'self@example.com', role: 'admin', status: 'active' }]
    render(<AdminAccountPage />)
    expect(screen.getByLabelText('變更 self@example.com 的角色').disabled).toBe(true)
    expect(screen.getByLabelText('刪除 self@example.com').disabled).toBe(true)
  })

  it('defaults an invite to viewer and only enables valid email submission', () => {
    render(<AdminAccountPage />)
    fireEvent.click(screen.getByRole('button', { name: '邀請帳號' }))
    expect(screen.getByLabelText('角色').value).toBe('viewer')
    expect(screen.getByRole('button', { name: '送出邀請' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }))
    expect(adminState.invite).toHaveBeenCalledWith('new@example.com', 'viewer')
  })

  it('shows the appropriate mail action for active and invited users', () => {
    render(<AdminAccountPage />)
    expect(screen.getByRole('button', { name: '重新寄送邀請 invitee@example.com' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '寄送密碼重設 member@example.com' })).toBeTruthy()
  })

  it('shows a relogin notice after requesting a role change', async () => {
    render(<AdminAccountPage />)
    fireEvent.change(screen.getByLabelText('變更 member@example.com 的角色'), { target: { value: 'viewer' } })
    expect(adminState.changeRole).toHaveBeenCalledWith('u3', 'viewer')
    await waitFor(() => expect(screen.getByText('角色變更後，該使用者需要重新登入。')).toBeTruthy())
  })

  it('keeps the invite dialog and entered email open when inviting fails', async () => {
    adminState.invite.mockResolvedValueOnce(false)
    render(<AdminAccountPage />)
    fireEvent.click(screen.getByRole('button', { name: '邀請帳號' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'failed@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }))
    await waitFor(() => expect(adminState.invite).toHaveBeenCalledWith('failed@example.com', 'viewer'))
    expect(screen.getByRole('dialog', { name: '邀請帳號' })).toBeTruthy()
    expect(screen.getByLabelText('Email').value).toBe('failed@example.com')
  })

  it('keeps the delete dialog open when deletion fails', async () => {
    adminState.remove.mockResolvedValueOnce(false)
    render(<AdminAccountPage />)
    fireEvent.click(screen.getByLabelText('刪除 member@example.com'))
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: 'member@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '永久刪除' }))
    await waitFor(() => expect(adminState.remove).toHaveBeenCalledWith('u3', 'member@example.com'))
    expect(screen.getByRole('dialog', { name: '永久刪除帳號' })).toBeTruthy()
    expect(screen.getByLabelText('輸入確認 Email').value).toBe('member@example.com')
  })

  it('does not show the relogin notice when a role change fails', async () => {
    adminState.changeRole.mockResolvedValueOnce(false)
    render(<AdminAccountPage />)
    fireEvent.change(screen.getByLabelText('變更 member@example.com 的角色'), { target: { value: 'viewer' } })
    await waitFor(() => expect(adminState.changeRole).toHaveBeenCalledWith('u3', 'viewer'))
    expect(screen.queryByText('角色變更後，該使用者需要重新登入。')).toBeNull()
  })

  it('renders summary counts and audit snapshots', () => {
    render(<AdminAccountPage />)
    expect(screen.getAllByText('3', { selector: '.admin-summary-value' })).toHaveLength(1)
    expect(screen.getAllByText('1', { selector: '.admin-summary-value' })).toHaveLength(2)
    expect(screen.getByText('old@example.com')).toBeTruthy()
    expect(screen.getAllByText('admin@example.com')).toHaveLength(2)
  })

  it('renders loading and localized fixed error code states', () => {
    adminState.loading = true
    const { rerender } = render(<AdminAccountPage />)
    expect(screen.getByText('載入帳號資料中…')).toBeTruthy()
    adminState.loading = false
    adminState.errorCode = 'LAST_ADMIN_PROTECTED'
    rerender(<AdminAccountPage />)
    expect(screen.getByText('至少保留一位管理員帳號。')).toBeTruthy()
  })
})
