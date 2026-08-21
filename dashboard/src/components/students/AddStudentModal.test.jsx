import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AddStudentModal from './AddStudentModal'

describe('AddStudentModal', () => {
  it('does not dismiss when its outer overlay is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<AddStudentModal students={[]} onClose={onClose} />)

    fireEvent.click(container.querySelector('#modal-add-student-overlay'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
