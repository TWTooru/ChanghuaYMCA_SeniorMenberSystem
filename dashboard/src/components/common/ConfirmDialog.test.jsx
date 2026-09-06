import { render, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ConfirmDialog from './ConfirmDialog'
import { Dialog, DialogContent } from '../ui/dialog'

describe('ConfirmDialog', () => {
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
