import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnrollmentTimeline from './EnrollmentTimeline'

vi.mock('./EnrollmentEditForm', () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="edit-form">
      <button type="button" onClick={onSave}>save</button>
      <button type="button" onClick={onCancel}>cancel</button>
    </div>
  ),
}))

const baseEnrollment = {
  enrollment_id: 1,
  period: '2026 Spring',
  reg_type: 'new',
  refunded: false,
  courses: ['Math', 'English'],
  billingReceipts: [],
  courseDetails: [],
}

function renderTimeline(props = {}) {
  return render(<EnrollmentTimeline timeline={[baseEnrollment]} {...props} />)
}

function selectionButton(container) {
  return container.querySelector('.timeline-card-select')
}

describe('EnrollmentTimeline', () => {
  afterEach(cleanup)

  it('shows the receipt total and invoice numbers in a billing summary', () => {
    renderTimeline({
      timeline: [{
        ...baseEnrollment,
        billingReceipts: [
          { receiptId: 1, amount: 1500, invoiceNumber: 'A-001', courses: [] },
          { receiptId: 2, amount: 500, invoiceNumber: 'A-002', courses: [] },
        ],
      }],
    })

    const summary = screen.getByTestId('timeline-billing-summary')
    expect(summary.textContent).toContain('NT$ 2000')
    expect(summary.textContent).toContain('A-001, A-002')
  })

  it('shows placeholders when no billing values exist', () => {
    renderTimeline()

    const values = screen.getByTestId('timeline-billing-summary').querySelectorAll('span')
    expect(Array.from(values, value => value.textContent)).toEqual(['--', '--'])
  })

  it('selects the enrollment when its card is clicked', () => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment })

    fireEvent.click(selectionButton(container))

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(baseEnrollment)
  })

  it.each(['Enter', ' '])('selects the enrollment exactly once when %s activates its native button', (key) => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment })
    const selectButton = selectionButton(container)

    fireEvent.keyDown(selectButton, { key })
    fireEvent.click(selectButton)

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(baseEnrollment)
  })

  it('does not select the enrollment when its edit control is clicked', () => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment, onEditEnrollment: true })

    fireEvent.click(container.querySelector('.timeline-action-btn'))

    expect(onSelectEnrollment).not.toHaveBeenCalled()
    expect(screen.getByTestId('edit-form')).toBeTruthy()
  })

  it('does not select the enrollment when its delete control is clicked', () => {
    const onSelectEnrollment = vi.fn()
    const onDelete = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment, onDelete })

    fireEvent.click(container.querySelector('.timeline-action-btn.danger'))

    expect(onSelectEnrollment).not.toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(baseEnrollment.enrollment_id)
  })

  it.each(['Enter', ' '])('does not select the enrollment from the %s key on its edit control', (key) => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment, onEditEnrollment: true })
    const editButton = container.querySelector('.timeline-action-btn')

    fireEvent.keyDown(editButton, { key })
    fireEvent.click(editButton)

    expect(onSelectEnrollment).not.toHaveBeenCalled()
    expect(screen.getByTestId('edit-form')).toBeTruthy()
  })

  it.each(['Enter', ' '])('does not select the enrollment from the %s key on its delete control', (key) => {
    const onSelectEnrollment = vi.fn()
    const onDelete = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment, onDelete })
    const deleteButton = container.querySelector('.timeline-action-btn.danger')

    fireEvent.keyDown(deleteButton, { key })
    fireEvent.click(deleteButton)

    expect(onSelectEnrollment).not.toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalledOnce()
    expect(onDelete).toHaveBeenCalledWith(baseEnrollment.enrollment_id)
  })

  it('does not select an enrollment while its card is being edited', () => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment, onEditEnrollment: true })

    fireEvent.click(container.querySelector('.timeline-action-btn'))
    fireEvent.click(screen.getByTestId('edit-form').closest('.timeline-card'))

    expect(onSelectEnrollment).not.toHaveBeenCalled()
  })

  it('does not throw when no selection handler is provided', () => {
    const { container } = renderTimeline()
    const card = selectionButton(container)

    expect(() => {
      fireEvent.click(card)
      fireEvent.keyDown(card, { key: 'Enter' })
    }).not.toThrow()
  })

  it('keeps action controls outside the selection button semantics', () => {
    const { container } = renderTimeline({ onDelete: vi.fn() })
    const card = container.querySelector('.timeline-card')
    const selectButton = selectionButton(container)

    expect(card.getAttribute('role')).toBeNull()
    expect(selectButton).toBeTruthy()
    expect(selectButton.querySelector('.timeline-action-btn')).toBeNull()
  })
})
