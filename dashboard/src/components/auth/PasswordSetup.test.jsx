import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PasswordSetup from './PasswordSetup'

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { auth: { updateUser } },
}))

describe('PasswordSetup', () => {
  const onComplete = vi.fn()

  beforeEach(() => {
    updateUser.mockReset()
    onComplete.mockReset()
  })

  afterEach(cleanup)

  it('shows expired link copy without a session and does not call auth', () => {
    render(<PasswordSetup session={null} flow="invite" onComplete={onComplete} />)

    expect(screen.getByText('此連結已失效或已過期，請重新取得設定密碼連結。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '返回登入頁' }))
    expect(updateUser).not.toHaveBeenCalled()
    expect(onComplete).toHaveBeenCalledOnce()
  })

  it('disables submission when passwords do not match', () => {
    render(<PasswordSetup session={{ access_token: 'token' }} flow="invite" onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'password2' } })

    expect(screen.getByRole('button', { name: '設定密碼' }).disabled).toBe(true)
  })

  it('rejects passwords shorter than eight characters', () => {
    render(<PasswordSetup session={{ access_token: 'token' }} flow="recovery" onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'short' } })

    expect(screen.getByText('密碼至少需要 8 個字元。')).toBeTruthy()
    expect(screen.getByRole('button', { name: '設定密碼' }).disabled).toBe(true)
  })

  it('updates a valid matching password and completes after success', async () => {
    updateUser.mockResolvedValue({ error: null })
    render(<PasswordSetup session={{ access_token: 'token' }} flow="invite" onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'password1' } })
    fireEvent.click(screen.getByRole('button', { name: '設定密碼' }))

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: 'password1' }))
    await waitFor(() => expect(onComplete).toHaveBeenCalledOnce())
    expect(screen.getByLabelText('新密碼').value).toBe('')
    expect(screen.getByLabelText('確認新密碼').value).toBe('')
  })

  it('keeps the flow open and shows localized copy when Supabase fails', async () => {
    updateUser.mockResolvedValue({ error: new Error('network') })
    render(<PasswordSetup session={{ access_token: 'token' }} flow="recovery" onComplete={onComplete} />)

    fireEvent.change(screen.getByLabelText('新密碼'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('確認新密碼'), { target: { value: 'password1' } })
    fireEvent.click(screen.getByRole('button', { name: '設定密碼' }))

    expect(await screen.findByText('密碼設定失敗，請重新開啟連結後再試一次。')).toBeTruthy()
    expect(onComplete).not.toHaveBeenCalled()
    expect(screen.getByLabelText('新密碼').value).toBe('password1')
  })
})
