import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import UserManualTab from './UserManualTab'

describe('UserManualTab', () => {
  afterEach(cleanup)

  it('provides navigable guidance for the system workflows shared by editors and admins', () => {
    render(<UserManualTab role="editor" />)

    expect(screen.getByRole('heading', { name: '使用者手冊', level: 1 })).toBeTruthy()
    const navigation = screen.getByRole('navigation', { name: '手冊章節' })
    expect(within(navigation).getByRole('link', { name: '快速開始' }).getAttribute('href')).toBe('#manual-start')

    for (const heading of ['快速開始', '學員資料', '選課與收費', 'Excel 匯入與匯出', '角色權限與資料安全']) {
      expect(screen.getByRole('heading', { name: heading })).toBeTruthy()
    }
    expect(screen.getByRole('table', { name: '角色權限一覽' })).toBeTruthy()
    expect(screen.getByRole('list', { name: '開始使用步驟' })).toBeTruthy()
    expect(screen.getByText('修改既有會員資料時，離開未儲存的編輯表單會要求確認，避免誤丟資料。')).toBeTruthy()
    expect(screen.getByText('先檢查匯入預覽中的新增、更新、提醒及錯誤資料。')).toBeTruthy()
  })

  it('shows admin procedures to admins and an access explanation to editors', () => {
    const { rerender } = render(<UserManualTab role="editor" />)

    expect(screen.queryByRole('heading', { name: '管理員專屬操作' })).toBeNull()
    expect(screen.getByText(/編輯者無法使用帳號管理、課程管理及刪除功能/)).toBeTruthy()

    rerender(<UserManualTab role="admin" />)

    expect(screen.getByRole('heading', { name: '管理員專屬操作' })).toBeTruthy()
    expect(screen.queryByText(/編輯者無法使用帳號管理、課程管理及刪除功能/)).toBeNull()
  })

  it('documents equal peer owner governance to admins', () => {
    render(<UserManualTab role="admin" />)

    const table = screen.getByRole('table', { name: '角色權限一覽' })
    expect(within(table).getByRole('cell', { name: '可管理其他最高管理員與所有角色' })).toBeTruthy()
    for (const roleName of ['檢視者', '編輯者', '管理員', '最高管理員']) {
      expect(within(table).getByRole('columnheader', { name: roleName })).toBeTruthy()
    }
    expect(screen.getByText('最高管理員可以指派其他最高管理員，並管理其他最高管理員帳號。')).toBeTruthy()
    expect(screen.getByText('一般管理員只能管理檢視者與編輯者，不能管理其他管理員或最高管理員。')).toBeTruthy()
    expect(screen.getByText('系統至少保留一位最高管理員；任何人都不能變更自己的角色或刪除自己的帳號。')).toBeTruthy()
  })

  it('keeps account-governance instructions hidden from editors', () => {
    render(<UserManualTab role="editor" />)

    expect(screen.queryByText('最高管理員可以指派其他最高管理員，並管理其他最高管理員帳號。')).toBeNull()
    expect(screen.queryByText(/一般管理員只能管理檢視者與編輯者/)).toBeNull()
    expect(screen.queryByText(/系統至少保留一位最高管理員/)).toBeNull()
  })

  it('gives owner the highest-admin badge and every admin-only section', () => {
    render(<UserManualTab role="owner" />)

    const badge = document.querySelector('.manual-role-badge--owner')
    expect(badge).toBeTruthy()
    expect(within(badge).getByText('最高管理員')).toBeTruthy()
    expect(screen.getByRole('heading', { name: '管理員專屬操作' })).toBeTruthy()
    expect(screen.getByText('最高管理員可以指派其他最高管理員，並管理其他最高管理員帳號。')).toBeTruthy()
  })
})
