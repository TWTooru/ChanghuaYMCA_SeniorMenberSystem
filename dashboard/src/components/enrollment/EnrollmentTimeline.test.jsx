import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentTimeline from './EnrollmentTimeline'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const enrollmentStyles = readFileSync(resolve(testDirectory, './enrollment.css'), 'utf8')
const adminStyles = readFileSync(resolve(testDirectory, '../admin/admin.css'), 'utf8')

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
  let styleElement

  beforeEach(() => {
    styleElement = document.createElement('style')
    styleElement.textContent = `${adminStyles}\n${enrollmentStyles}`
    document.head.append(styleElement)
  })

  afterEach(() => {
    styleElement.remove()
    cleanup()
  })

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
    const selectButton = selectionButton(container)

    fireEvent.click(selectButton)

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(baseEnrollment, selectButton)
  })

  it.each(['Enter', ' '])('selects the enrollment exactly once when %s activates its native button', (key) => {
    const onSelectEnrollment = vi.fn()
    const { container } = renderTimeline({ onSelectEnrollment })
    const selectButton = selectionButton(container)

    fireEvent.keyDown(selectButton, { key })
    fireEvent.click(selectButton)

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(baseEnrollment, selectButton)
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

  it('restores the card spacing and default cursor while inline editing', () => {
    const { container } = renderTimeline({ onEditEnrollment: true })

    fireEvent.click(container.querySelector('.timeline-action-btn'))

    const cardStyle = getComputedStyle(screen.getByTestId('edit-form').closest('.timeline-card'))
    expect(cardStyle.paddingTop).toBe('16px')
    expect(cardStyle.cursor).toBe('default')
  })

  it('reserves enough selection-button space for both card actions', () => {
    const { container } = renderTimeline({
      onEditEnrollment: true,
      onDelete: vi.fn(),
    })

    const selectButton = selectionButton(container)
    const actions = container.querySelector('.timeline-actions')
    const actionButtons = Array.from(actions.querySelectorAll('.timeline-action-btn'))
    const actionStyles = getComputedStyle(actions)
    const reservedSpace = Number.parseFloat(getComputedStyle(selectButton).paddingRight)
    const actionsWidth = actionButtons.reduce((total, button) => (
      total + Number.parseFloat(getComputedStyle(button).width)
    ), 0)
    const interButtonGap = Number.parseFloat(actionStyles.gap) * (actionButtons.length - 1)
    const rightInset = Number.parseFloat(actionStyles.right)

    expect(reservedSpace).toBeGreaterThanOrEqual(actionsWidth + interButtonGap + rightInset)
  })
})
