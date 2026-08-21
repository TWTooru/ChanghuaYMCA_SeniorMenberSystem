import { useRef, useState } from 'react'
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import useModalA11y from './useModalA11y'

function Harness({ onClose = vi.fn(), controls = true }) {
  const modalRef = useRef(null)
  useModalA11y(modalRef, onClose)

  return (
    <div ref={modalRef} role="dialog" tabIndex={-1}>
      {controls && <><button type="button">First</button><button type="button">Last</button></>}
    </div>
  )
}

function ClosableHarness() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open modal</button>
      {open && <Harness onClose={() => setOpen(false)} />}
    </>
  )
}

describe('useModalA11y', () => {
  afterEach(cleanup)

  it('focuses the first control when the modal opens', () => {
    render(<Harness />)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }))
  })

  it('wraps Tab from the last control to the first', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    const first = screen.getByRole('button', { name: 'First' })
    screen.getByRole('button', { name: 'Last' }).focus()

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
  })

  it('wraps Shift+Tab from the first control to the last', () => {
    render(<Harness />)
    const dialog = screen.getByRole('dialog')
    const last = screen.getByRole('button', { name: 'Last' })
    screen.getByRole('button', { name: 'First' }).focus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
  })

  it('wraps focus back into the modal when focus is outside it', () => {
    const { container } = render(<><button type="button">Outside</button><Harness /></>)
    const dialog = screen.getByRole('dialog')
    const last = screen.getByRole('button', { name: 'Last' })
    screen.getByRole('button', { name: 'Outside' }).focus()

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    expect(container.contains(document.activeElement)).toBe(true)
  })

  it('calls onClose exactly once for Escape', () => {
    const onClose = vi.fn()
    render(<Harness onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('restores focus to the opener after unmount', () => {
    render(<ClosableHarness />)
    const opener = screen.getByRole('button', { name: 'Open modal' })
    opener.focus()
    fireEvent.click(opener)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(document.activeElement).toBe(opener)
  })

  it('prevents Tab from leaving a modal with no focusable controls', () => {
    render(<Harness controls={false} />)
    const dialog = screen.getByRole('dialog')
    dialog.focus()
    const event = createEvent.keyDown(dialog, { key: 'Tab' })

    fireEvent(dialog, event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(dialog)
  })
})
