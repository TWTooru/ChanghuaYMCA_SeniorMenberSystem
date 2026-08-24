import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import RoleAccessState from './RoleAccessState'

function deferred() {
  let resolve
  const promise = new Promise(resolvePromise => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('RoleAccessState', () => {
  afterEach(cleanup)

  it.each([
    ['unassigned', 'ROLE_NOT_ASSIGNED', '此帳號尚未設定系統角色，請聯絡最高管理員。'],
    ['error', 'ROLE_STORE_ERROR', '目前無法確認帳號權限，請稍後重試。'],
  ])('renders the private %s explanation and both recovery actions', (status, errorCode, message) => {
    render(
      <RoleAccessState
        status={status}
        errorCode={errorCode}
        onRetry={vi.fn()}
        onSignOut={vi.fn()}
      />,
    )

    expect(screen.getByText(message)).toBeTruthy()
    expect(screen.getByRole('button', { name: '重試' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '登出' })).toBeTruthy()
  })

  it('calls sign out from the isolated access state', () => {
    const onSignOut = vi.fn()
    render(<RoleAccessState status="error" errorCode="ROLE_STORE_ERROR" onRetry={vi.fn()} onSignOut={onSignOut} />)

    fireEvent.click(screen.getByRole('button', { name: '登出' }))

    expect(onSignOut).toHaveBeenCalledOnce()
  })

  it('awaits one retry at a time and restores the action after completion', async () => {
    const retry = deferred()
    const onRetry = vi.fn(() => retry.promise)
    render(<RoleAccessState status="error" errorCode="ROLE_STORE_ERROR" onRetry={onRetry} onSignOut={vi.fn()} />)

    const retryButton = screen.getByRole('button', { name: '重試' })
    fireEvent.click(retryButton)
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalledOnce()
    expect(retryButton.disabled).toBe(true)

    await act(async () => {
      retry.resolve()
      await retry.promise
    })
    await waitFor(() => expect(retryButton.disabled).toBe(false))
  })

  it('contains a rejected retry and lets the user try again', async () => {
    const onRetry = vi.fn().mockRejectedValueOnce(new Error('private store detail'))
    render(<RoleAccessState status="error" errorCode="ROLE_STORE_ERROR" onRetry={onRetry} onSignOut={vi.fn()} />)

    const retryButton = screen.getByRole('button', { name: '重試' })
    fireEvent.click(retryButton)

    await waitFor(() => expect(retryButton.disabled).toBe(false))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByText(/private store detail/)).toBeNull()
  })

  it('restores retry state after StrictMode replays the mount effect', async () => {
    const retry = deferred()
    render(
      <StrictMode>
        <RoleAccessState
          status="error"
          errorCode="ROLE_STORE_ERROR"
          onRetry={() => retry.promise}
          onSignOut={vi.fn()}
        />
      </StrictMode>,
    )

    const retryButton = screen.getByRole('button', { name: '重試' })
    fireEvent.click(retryButton)
    await act(async () => {
      retry.resolve()
      await retry.promise
    })

    await waitFor(() => expect(retryButton.disabled).toBe(false))
  })
})
