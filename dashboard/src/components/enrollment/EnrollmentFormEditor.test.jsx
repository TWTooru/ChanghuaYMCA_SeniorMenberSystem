import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentFormEditor from './EnrollmentFormEditor'
import { updateEnrollmentForm } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentForm: vi.fn(),
}))

vi.mock('./CourseTagPicker', () => ({
  default: ({ selectedCourseNames, lockedCourseNames = [], onChange, disabled }) => (
    <section aria-label="course picker">
      {['課程A', '課程B', '課程C', '課程D'].map(courseName => {
        const isLocked = lockedCourseNames.includes(courseName)
        return (
          <button
            key={courseName}
            type="button"
            disabled={disabled || isLocked}
            aria-pressed={selectedCourseNames.includes(courseName)}
            onClick={() => onChange(
              selectedCourseNames.includes(courseName)
                ? selectedCourseNames.filter(name => name !== courseName)
                : [...selectedCourseNames, courseName],
            )}
          >
            {courseName}
          </button>
        )
      })}
    </section>
  ),
}))

const formFixture = {
  form_id: 12,
  form_sequence: 2,
  reg_type: '續',
  courses: ['課程C', '課程D'],
  prepaid_amount: 300,
  prepaid_receipt_number: 'P-2',
  tuition_fee: 1800,
  materials_fee: 100,
  membership_fee: 0,
  fee_receipt_number: 'F-2',
  handled_by_name: '李承辦',
  handled_by_account: 'lee@example.com',
  reported_on: '2026-08-21',
  notes: '第二張',
}

describe('EnrollmentFormEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('populates initial form values and locks sibling courses', () => {
    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={['課程A', '課程B']}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('新/續生').value).toBe('續')
    expect(screen.getByLabelText('預繳金額').value).toBe('300')
    expect(screen.getByLabelText('預繳收據號碼').value).toBe('P-2')
    expect(screen.getByLabelText('學費').value).toBe('1800')
    expect(screen.getByLabelText('教材費').value).toBe('100')
    expect(screen.getByLabelText('會友費').value).toBe('0')
    expect(screen.getByLabelText('正式費用合計').textContent).toBe('NT$ 1900')
    expect(screen.getByLabelText('正式收據號碼').value).toBe('F-2')
    expect(screen.getByLabelText('經手人').value).toBe('李承辦')
    expect(screen.getByLabelText('報到日期').value).toBe('2026-08-21')
    expect(screen.getByLabelText('備註').value).toBe('第二張')

    // Sibling courses are locked
    expect(screen.getByRole('button', { name: '課程A' }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '課程B' }).disabled).toBe(true)
  })

  it('updates form fields and calls updateEnrollmentForm on save', async () => {
    vi.mocked(updateEnrollmentForm).mockResolvedValue(undefined)
    const onSave = vi.fn()

    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={['課程A']}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2000' } })
    fireEvent.change(screen.getByLabelText('備註'), { target: { value: '修改備註' } })

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(updateEnrollmentForm).toHaveBeenCalledWith(
      expect.anything(),
      12,
      expect.objectContaining({
        courses: ['課程C', '課程D'],
        prepaid_amount: 300,
        prepaid_receipt_number: 'P-2',
        tuition_fee: 2000,
        materials_fee: 100,
        membership_fee: 0,
        fee_receipt_number: 'F-2',
        reported_on: '2026-08-21',
        notes: '修改備註',
      }),
    ))
    expect(onSave).toHaveBeenCalledOnce()
  })

  it('validates empty courses before saving', async () => {
    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    // Deselect C and D
    fireEvent.click(screen.getByRole('button', { name: '課程C' }))
    fireEvent.click(screen.getByRole('button', { name: '課程D' }))

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('請至少選擇一門課程')
    expect(updateEnrollmentForm).not.toHaveBeenCalled()
  })

  it('validates negative amounts before saving', async () => {
    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={[]}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('預繳金額'), { target: { value: '-50' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('金額必須為非負整數')
    expect(updateEnrollmentForm).not.toHaveBeenCalled()
  })

  it('shows error on save failure and preserves edited values', async () => {
    vi.mocked(updateEnrollmentForm).mockRejectedValue(new Error('已有收據的課程不能移除'))
    const onSave = vi.fn()

    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={[]}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2500' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('已有收據的課程不能移除')
    expect(screen.getByLabelText('學費').value).toBe('2500')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('calls onCancel when cancel button is clicked', () => {
    const onCancel = vi.fn()

    render(
      <EnrollmentFormEditor
        form={formFixture}
        siblingCourseNames={[]}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '取消' }))
    expect(onCancel).toHaveBeenCalledOnce()
  })
})
