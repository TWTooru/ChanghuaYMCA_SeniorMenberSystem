import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import CollapsiblePanel from './CollapsiblePanel'

afterEach(cleanup)

describe('CollapsiblePanel', () => {
  it('exposes a named region through the shared card primitive', () => {
    const { container } = render(
      <CollapsiblePanel title="測試卡片">
        <p>卡片內容</p>
      </CollapsiblePanel>,
    )

    expect(screen.getByRole('region', { name: '測試卡片' })).toBeTruthy()
    expect(container.querySelector('[data-slot="card"]')).not.toBeNull()
  })

  it('is expanded by default and toggles its content', () => {
    render(
      <CollapsiblePanel title="測試卡片">
        <p>卡片內容</p>
      </CollapsiblePanel>,
    )

    const toggle = screen.getByRole('button', { name: '收合測試卡片' })
    expect(screen.getByText('卡片內容')).toBeTruthy()
    expect(toggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(toggle)

    expect(screen.queryByText('卡片內容')).toBeNull()
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })
})

