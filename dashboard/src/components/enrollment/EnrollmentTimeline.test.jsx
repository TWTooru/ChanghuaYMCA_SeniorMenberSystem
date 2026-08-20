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

  it('renders multi-form batch count, partial refund badge, and flattened courses', () => {
    renderTimeline({
      timeline: [{
        ...baseEnrollment,
        formCount: 2,
        refundStatus: 'partial',
        courses: ['課程A', '課程D'],
      }],
    })

    expect(screen.getByText('2 張報名表')).toBeTruthy()
    expect(screen.getByText('部分退費')).toBeTruthy()
    expect(screen.getByText('課程A')).toBeTruthy()
    expect(screen.getByText('課程D')).toBeTruthy()
  })

  it('shows prepaid and formal breakdowns in billing summary', () => {
    renderTimeline({
      timeline: [{
        ...baseEnrollment,
        prepaid_amount: 500,
        prepaid_receipt_number: 'P-01',
        tuition_fee: 1500,
        materials_fee: 200,
        membership_fee: 100,
        fee_receipt_number: 'F-01',
      }],
    })

    const summary = screen.getByTestId('timeline-billing-summary')
    expect(summary.textContent).toContain('預繳: NT$ 500 (No.P-01)')
    expect(summary.textContent).toContain('正式: NT$ 1800 (No.F-01)')
  })

  it('aggregates prepaid, formal, and handler details from enrollment forms in billing summary', () => {
    renderTimeline({
      timeline: [{
        ...baseEnrollment,
        forms: [
          {
            form_id: 1,
            form_sequence: 1,
            prepaid_amount: 500,
            prepaid_receipt_number: 'P-1',
            tuition_fee: 1000,
            materials_fee: 200,
            membership_fee: 100,
            fee_receipt_number: 'F-1',
            handled_by_name: '張組長',
            reported_on: '2026-08-18',
            refunded: false,
          },
          {
            form_id: 2,
            form_sequence: 2,
            tuition_fee: 800,
            materials_fee: 0,
            membership_fee: 0,
            fee_receipt_number: 'F-2',
            handled_by_name: '李幹事',
            reported_on: '2026-08-20',
            refunded: false,
          },
        ],
      }],
    })

    const summary = screen.getByTestId('timeline-billing-summary')
    expect(summary.textContent).toContain('預繳: NT$ 500 (No.P-1)')
    expect(summary.textContent).toContain('正式: NT$ 2100 (No.F-1, F-2)')
    expect(summary.textContent).toContain('經手: 張組長, 李幹事 (2026-08-20)')
  })

  it('renders handler name and date inside billing summary on the right', () => {
    renderTimeline({
      timeline: [{
        ...baseEnrollment,
        handled_by_name: '張組長',
        handled_on: '2026-08-18',
      }],
    })

    const summary = screen.getByTestId('timeline-billing-summary')
    expect(summary.textContent).toContain('經手: 張組長 (2026-08-18)')
  })

  it('omits billing summary when no billing values exist', () => {
    renderTimeline()

    expect(screen.queryByTestId('timeline-billing-summary')).toBeNull()
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
