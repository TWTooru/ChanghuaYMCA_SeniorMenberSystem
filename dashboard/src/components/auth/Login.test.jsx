import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Login from './Login'

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    auth: { signInWithPassword },
  },
}))

describe('Login', () => {
  beforeEach(() => {
    signInWithPassword.mockReset()
  })

  afterEach(cleanup)

  it('loads only the YMCA logo relative to the deployed application directory', () => {
    render(<Login />)

    expect(screen.getByAltText('YMCA Logo').getAttribute('src')).toBe('./YMCA.png')
    expect(screen.queryByAltText('Active Aging Center Logo')).toBeNull()
  })

  it('submits the entered credentials and clears the form after success', async () => {
    const onLoginSuccess = vi.fn()
    signInWithPassword.mockResolvedValue({ error: null })

    render(<Login onLoginSuccess={onLoginSuccess} />)

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'secret-password',
      })
    })
    expect(onLoginSuccess).toHaveBeenCalledOnce()
    expect(screen.getByLabelText('Email Address').value).toBe('')
    expect(screen.getByLabelText('Password').value).toBe('')
  })

  it('shows the authentication error and keeps the entered credentials', async () => {
    signInWithPassword.mockResolvedValue({
      error: new Error('Invalid login credentials'),
    })

    render(<Login />)

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'wrong-password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    const errorMessage = await screen.findByText('Invalid login credentials')
    expect(errorMessage.classList.contains('login-error')).toBe(true)
    expect(screen.getByLabelText('Email Address').value).toBe('user@example.com')
    expect(screen.getByLabelText('Password').value).toBe('wrong-password')
  })

  it('recovers from a rejected authentication request', async () => {
    signInWithPassword.mockRejectedValue(new Error('network offline'))

    render(<Login />)

    fireEvent.change(screen.getByLabelText('Email Address'), {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'password' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    expect(await screen.findByText('登入服務暫時無法使用，請稍後再試。')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign In' }).disabled).toBe(false)
    expect(screen.getByLabelText('Email Address').value).toBe('user@example.com')
    expect(screen.getByLabelText('Password').value).toBe('password')
  })
})
