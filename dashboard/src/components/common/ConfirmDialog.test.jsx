import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from './ConfirmDialog'
import { Dialog, DialogContent } from '../ui/dialog'

function renderDialog(overrides = {}) {
  const props = {
    isOpen: true,
    title: 'Delete this student',
    message: 'This cannot be undone.',
    cancelLabel: 'Cancel',
    confirmLabel: 'Confirm',
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  }
  return { ...render(<ConfirmDialog {...props} />), props }
}

describe('ConfirmDialog', () => {
  afterEach(cleanup)

  it('exposes accessible dialog semantics and focuses cancel initially', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.getAttribute('aria-labelledby')).toBe('confirm-dialog-title')
    expect(screen.getByRole('heading', { name: 'Delete this student' }).id).toBe('confirm-dialog-title')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
  })

  it('cancels on Escape but not when the overlay is clicked', () => {
    const { container, props } = renderDialog()
    fireEvent.click(container.querySelector('.modal-overlay-center'))
    expect(props.onCancel).not.toHaveBeenCalled()
    expect(props.onConfirm).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('activates modal keyboard handling when opened after an initial closed render', () => {
    const { props, rerender } = renderDialog({ isOpen: false })
    rerender(<ConfirmDialog {...props} isOpen />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(props.onCancel).toHaveBeenCalledOnce()
  })

  it('invokes only onConfirm when confirmed', () => {
    const { props } = renderDialog()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }))
    expect(props.onConfirm).toHaveBeenCalledOnce()
    expect(props.onCancel).not.toHaveBeenCalled()
  })

  it('keeps background scrolling locked until the last open dialog closes', () => {
    document.documentElement.style.overflow = 'scroll'

    const props = { title: '確認', message: '請確認操作', onConfirm: () => {}, onCancel: () => {} }
    const { rerender } = render(
      <>
        <ConfirmDialog isOpen {...props} />
        <ConfirmDialog isOpen {...props} />
      </>,
    )

    expect(document.documentElement.style.overflow).toBe('hidden')

    rerender(<ConfirmDialog isOpen {...props} />)
    expect(document.documentElement.style.overflow).toBe('hidden')

    rerender(<ConfirmDialog isOpen={false} {...props} />)
    expect(document.documentElement.style.overflow).toBe('scroll')
  })

  it('keeps the Base UI scroll lock intact when a custom dialog closes first', async () => {
    document.documentElement.style.overflow = ''

    const props = { title: '確認', message: '請確認操作', onConfirm: () => {}, onCancel: () => {} }
    const { rerender } = render(
      <>
        <ConfirmDialog isOpen {...props} />
        <Dialog open><DialogContent showCloseButton={false}>Base UI dialog</DialogContent></Dialog>
      </>,
    )

    await waitFor(() => expect(document.documentElement.style.overflowY).toBe('hidden'))

    rerender(<Dialog open><DialogContent showCloseButton={false}>Base UI dialog</DialogContent></Dialog>)

    await waitFor(() => expect(document.documentElement.style.overflowY).toBe('hidden'))
  })
})
