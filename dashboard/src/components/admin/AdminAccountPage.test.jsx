import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminAccountPage from './AdminAccountPage'
import { useAuth } from '../../contexts/AuthContext'
import useAdminUsers from '../../hooks/useAdminUsers'

vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }))
vi.mock('../../hooks/useAdminUsers', () => ({ default: vi.fn() }))

const signedInAt = '2026-07-14T00:00:00.000Z'
const makeUser = (id, role, overrides = {}) => ({
  id,
  email: `${id}@example.com`,
  role,
  status: 'active',
  lastSignInAt: signedInAt,
  ...overrides,
})

const authState = { role: 'admin', user: { id: 'actor', email: 'actor@example.com' } }
const adminState = {
  users: [],
  auditLogs: [],
  loading: false,
  mutation: null,
  errorCode: null,
  refresh: vi.fn(),
  invite: vi.fn(),
  changeRole: vi.fn(),
  resend: vi.fn(),
  resetPassword: vi.fn(),
  remove: vi.fn(),
}

function renderFor(actorRole, target, actorId = 'actor') {
  authState.role = actorRole
  authState.user = { id: actorId, email: `${actorId}@example.com` }
  adminState.users = [target]
  return render(<AdminAccountPage />)
}

function getTargetRow(target) {
  return screen.getByText(target.email).closest('tr')
}

function expectNoAccountActions(row, target) {
  expect(within(row).queryByRole('combobox')).toBeNull()
  expect(within(row).queryByLabelText(`重新寄送邀請 ${target.email}`)).toBeNull()
  expect(within(row).queryByLabelText(`寄送密碼重設 ${target.email}`)).toBeNull()
  expect(within(row).queryByLabelText(`刪除 ${target.email}`)).toBeNull()
}

function expectRoleOptions(row, expectedValues) {
  const select = within(row).getByRole('combobox')
  fireEvent.click(select)
  const roleLabels = { owner: '最高管理員', admin: '管理員', editor: '編輯者', viewer: '瀏覽者' }
  expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(expectedValues.map(value => roleLabels[value]))
  fireEvent.keyDown(select, { key: 'Escape' })
  return select
}

function chooseRole(email, label) {
  const select = screen.getByLabelText(`變更 ${email} 的角色`)
  fireEvent.click(select)
  const option = screen.getByRole('option', { name: label })
  fireEvent.pointerDown(option, { pointerType: 'mouse' })
  fireEvent.click(option)
}

describe('AdminAccountPage', () => {
  afterEach(cleanup)

  beforeEach(() => {
    vi.clearAllMocks()
    authState.role = 'admin'
    authState.user = { id: 'actor', email: 'actor@example.com' }
    adminState.users = []
    adminState.auditLogs = []
    adminState.loading = false
    adminState.mutation = null
    adminState.errorCode = null
    adminState.refresh.mockResolvedValue(undefined)
    adminState.invite.mockResolvedValue(true)
    adminState.changeRole.mockResolvedValue(true)
    adminState.resend.mockResolvedValue(true)
    adminState.resetPassword.mockResolvedValue(true)
    adminState.remove.mockResolvedValue(true)
    useAuth.mockImplementation(() => authState)
    useAdminUsers.mockImplementation(() => adminState)
  })

  it.each([
    ['editor', { id: 'editor', email: 'editor@example.com' }],
    ['viewer', { id: 'viewer', email: 'viewer@example.com' }],
    [null, { id: 'missing-role', email: 'missing-role@example.com' }],
    ['owner', null],
  ])('denies actor role %s or a missing actor without requesting the account list', (role, user) => {
    authState.role = role
    authState.user = user

    render(<AdminAccountPage />)

    expect(screen.getByText('您沒有帳號管理權限')).toBeTruthy()
    expect(useAdminUsers).not.toHaveBeenCalled()
  })

  it('locks the owner self row, labels it as the highest administrator, and exposes no actions', () => {
    const target = makeUser('owner-1', 'owner')
    renderFor('owner', target, 'owner-1')

    const row = getTargetRow(target)
    expect(within(row).getByText('最高管理員')).toBeTruthy()
    expect(within(row).getByText('目前登入帳號')).toBeTruthy()
    expectNoAccountActions(row, target)
  })

  it.each(['owner', 'admin', 'editor', 'viewer'])('lets the owner manage a peer %s with all role options and enabled actions', targetRole => {
    const target = makeUser(`target-${targetRole}`, targetRole)
    renderFor('owner', target, 'owner-1')

    const row = getTargetRow(target)
    expectRoleOptions(row, ['owner', 'admin', 'editor', 'viewer'])
    expect(within(row).getByLabelText(`寄送密碼重設 ${target.email}`).disabled).toBe(false)
    expect(within(row).getByLabelText(`刪除 ${target.email}`).disabled).toBe(false)
  })

  it('locks an ordinary admin self row without relying on the number of admins', () => {
    const target = makeUser('admin-self', 'admin')
    renderFor('admin', target, 'admin-self')

    const row = getTargetRow(target)
    expect(within(row).getByText('目前登入帳號')).toBeTruthy()
    expectNoAccountActions(row, target)
  })

  it.each([
    ['owner', '最高管理員'],
    ['admin', '管理員'],
  ])('locks an ordinary admin targeting %s and explains that only the owner may manage it', (targetRole, roleLabel) => {
    const target = makeUser(`target-${targetRole}`, targetRole)
    renderFor('admin', target)

    const row = getTargetRow(target)
    expect(within(row).getByText(roleLabel)).toBeTruthy()
    expect(within(row).getByText('僅最高管理員可管理')).toBeTruthy()
    expectNoAccountActions(row, target)
  })

  it.each(['editor', 'viewer'])('lets an ordinary admin manage a %s with viewer/editor options only', targetRole => {
    const target = makeUser(`target-${targetRole}`, targetRole)
    renderFor('admin', target)

    const row = getTargetRow(target)
    expectRoleOptions(row, ['editor', 'viewer'])
    expect(within(row).getByLabelText(`寄送密碼重設 ${target.email}`).disabled).toBe(false)
    expect(within(row).getByLabelText(`刪除 ${target.email}`).disabled).toBe(false)
  })

  it.each([null, 'legacy-admin'])('shows an unsafe target role %s diagnostically without controls or actions', targetRole => {
    const target = makeUser('invalid-target', targetRole)
    renderFor('owner', target, 'owner-1')

    const row = getTargetRow(target)
    expect(within(row).getByText('角色未設定')).toBeTruthy()
    expectNoAccountActions(row, target)
  })

  it('keeps invited manageable accounts role-locked while enabling resend and delete', () => {
    const target = makeUser('invitee', 'viewer', { status: 'invited', lastSignInAt: null })
    renderFor('admin', target)

    const row = getTargetRow(target)
    expect(within(row).getByRole('combobox').disabled).toBe(true)
    expect(within(row).getByLabelText(`重新寄送邀請 ${target.email}`).disabled).toBe(false)
    expect(within(row).getByLabelText(`刪除 ${target.email}`).disabled).toBe(false)
  })

  it('sends a password-reset request for the exact manageable active account', () => {
    const target = makeUser('reset-target', 'editor')
    renderFor('admin', target)

    fireEvent.click(screen.getByLabelText(`寄送密碼重設 ${target.email}`))

    expect(adminState.resetPassword).toHaveBeenCalledOnce()
    expect(adminState.resetPassword).toHaveBeenCalledWith('reset-target')
  })

  it('resends an invitation for the exact manageable invited account', () => {
    const target = makeUser('resend-target', 'viewer', { status: 'invited', lastSignInAt: null })
    renderFor('admin', target)

    fireEvent.click(screen.getByLabelText(`重新寄送邀請 ${target.email}`))

    expect(adminState.resend).toHaveBeenCalledOnce()
    expect(adminState.resend).toHaveBeenCalledWith('resend-target')
  })

  it('requires exact target email before permanent delete', () => {
    const target = makeUser('member', 'editor')
    renderFor('admin', target)
    fireEvent.click(screen.getByLabelText(`刪除 ${target.email}`))
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: 'wrong@example.com' } })
    expect(screen.getByRole('button', { name: '永久刪除' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: ` ${target.email.toUpperCase()} ` } })
    expect(screen.getByRole('button', { name: '永久刪除' }).disabled).toBe(false)
  })

  it('explains invited accounts begin as viewers and sends only their email', () => {
    renderFor('admin', makeUser('member', 'viewer'))
    fireEvent.click(screen.getByRole('button', { name: '邀請帳號' }))
    expect(screen.getByText('邀請的帳號預設為瀏覽者，你可以後續自行調整權限。')).toBeTruthy()
    expect(screen.queryByLabelText('角色')).toBeNull()
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }))
    expect(adminState.invite).toHaveBeenCalledWith('new@example.com')
  })

  it('shows only the exact success message after a role update', async () => {
    const target = makeUser('member', 'editor')
    renderFor('admin', target)

    chooseRole(target.email, '瀏覽者')

    expect(adminState.changeRole).toHaveBeenCalledWith(target.id, 'viewer')
    await waitFor(() => expect(screen.getByText('角色權限已更新。')).toBeTruthy())
    expect(screen.queryByText(/重新登入/)).toBeNull()
  })

  it('does not show the success message when a role update fails', async () => {
    adminState.changeRole.mockResolvedValueOnce(false)
    const target = makeUser('member', 'editor')
    renderFor('admin', target)

    chooseRole(target.email, '瀏覽者')

    await waitFor(() => expect(adminState.changeRole).toHaveBeenCalledWith(target.id, 'viewer'))
    expect(screen.queryByText('角色權限已更新。')).toBeNull()
  })

  it.each([
    ['ROLE_NOT_ASSIGNED', '此帳號尚未設定有效角色，請由最高管理員修正資料。'],
    ['OWNER_PROTECTED', '一般管理員不能操作最高管理員帳號。'],
    ['ADMIN_TARGET_FORBIDDEN', '一般管理員不能操作其他管理員帳號。'],
    ['OWNER_REQUIRED', '此操作僅限最高管理員。'],
    ['ROLE_STORE_ERROR', '角色資料目前無法讀取或更新，請稍後重試。'],
    ['LAST_OWNER_REQUIRED', '至少必須保留一位最高管理員；另一項操作可能已先完成，請重新整理後再試。'],
  ])('maps %s to its exact actionable message', (errorCode, message) => {
    adminState.errorCode = errorCode
    renderFor('owner', makeUser('member', 'viewer'), 'owner-1')

    expect(within(screen.getByRole('alert')).getByText(message)).toBeTruthy()
  })

  it('keeps target-specific errors visible while retaining the authorized account table', () => {
    adminState.errorCode = 'OWNER_REQUIRED'
    const target = makeUser('member', 'viewer')
    renderFor('admin', target)

    expect(screen.getByText(target.email)).toBeTruthy()
    expect(screen.getByText('此操作僅限最高管理員。')).toBeTruthy()
  })

  it('closes the invite dialog after a failed request and clears the email before reopening', async () => {
    adminState.invite.mockResolvedValueOnce(false)
    renderFor('admin', makeUser('member', 'viewer'))
    fireEvent.click(screen.getByRole('button', { name: '邀請帳號' }))
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'failed@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: '送出邀請' }))
    await waitFor(() => expect(adminState.invite).toHaveBeenCalledWith('failed@example.com'))
    expect(screen.queryByRole('dialog', { name: '邀請帳號' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '邀請帳號' }))
    expect(screen.getByLabelText('Email').value).toBe('')
  })

  it('keeps the delete dialog open when deletion fails', async () => {
    adminState.remove.mockResolvedValueOnce(false)
    const target = makeUser('member', 'editor')
    renderFor('admin', target)
    fireEvent.click(screen.getByLabelText(`刪除 ${target.email}`))
    fireEvent.change(screen.getByLabelText('輸入確認 Email'), { target: { value: target.email } })
    fireEvent.click(screen.getByRole('button', { name: '永久刪除' }))
    await waitFor(() => expect(adminState.remove).toHaveBeenCalledWith(target.id, target.email))
    expect(screen.getByRole('dialog', { name: '永久刪除帳號' })).toBeTruthy()
  })

  it('renders only account and invited summaries', () => {
    authState.role = 'owner'
    authState.user = { id: 'owner-1', email: 'owner-1@example.com' }
    adminState.users = [
      makeUser('admin-1', 'admin'),
      makeUser('invitee', 'viewer', { status: 'invited', lastSignInAt: null }),
      makeUser('editor-1', 'editor'),
    ]
    render(<AdminAccountPage />)

    expect(screen.getByText('全部帳號').nextSibling.textContent).toBe('3')
    expect(screen.getByText('待接受邀請').nextSibling.textContent).toBe('1')
    expect(screen.queryByText('管理員', { selector: '.admin-summary-card span' })).toBeNull()
  })

  it('renders loading and keeps an existing actionable error message', () => {
    adminState.loading = true
    const { rerender } = renderFor('admin', makeUser('member', 'viewer'))
    expect(screen.getByText('載入帳號資料中…')).toBeTruthy()
    adminState.loading = false
    adminState.errorCode = 'EMAIL_RATE_LIMITED'
    rerender(<AdminAccountPage />)
    expect(screen.getByText('邀請信寄送額度已滿，帳號可能已建立，請稍後從列表重新寄送邀請。')).toBeTruthy()
  })

  it('keeps the account list visible for a last-owner conflict without a success notice', () => {
    adminState.errorCode = 'LAST_OWNER_REQUIRED'
    const target = makeUser('owner-2', 'owner')
    renderFor('owner', target, 'owner-1')

    expect(screen.getByText(target.email)).toBeTruthy()
    expect(screen.getByText('至少必須保留一位最高管理員；另一項操作可能已先完成，請重新整理後再試。')).toBeTruthy()
    expect(screen.queryByText('角色權限已更新。')).toBeNull()
  })

  it('labels the account table for assistive technology', () => {
    renderFor('admin', makeUser('member', 'viewer'))

    expect(screen.getByRole('table', { name: '帳號列表' })).toBeTruthy()
  })
})
