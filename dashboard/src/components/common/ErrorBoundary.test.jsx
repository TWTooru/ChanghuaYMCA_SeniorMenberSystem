import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function BrokenChild() {
  throw new Error('render exploded')
}

describe('ErrorBoundary', () => {
  it('renders children while no descendant throws', () => {
    render(<ErrorBoundary><p>dashboard ready</p></ErrorBoundary>)

    expect(screen.getByText('dashboard ready')).toBeTruthy()
  })

  it('shows a recovery screen and invokes the reload seam', () => {
    const onReload = vi.fn()
    render(<ErrorBoundary onReload={onReload}><BrokenChild /></ErrorBoundary>)

    expect(screen.getByRole('alert').textContent).toContain('系統發生錯誤')
    fireEvent.click(screen.getByRole('button', { name: '重新載入頁面' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
