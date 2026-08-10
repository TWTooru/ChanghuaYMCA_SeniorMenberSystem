import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import CollapsiblePanel from './CollapsiblePanel'

describe('CollapsiblePanel', () => {
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
