import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentEditForm from './EnrollmentEditForm'
import { updateEnrollmentPeriod } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({ updateEnrollmentPeriod: vi.fn() }))

const enrollment = {
  enrollment_id: 1,
  period: '第16期',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
}

describe('EnrollmentEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.mocked(updateEnrollmentPeriod).mockResolvedValue()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('canonicalizes a valid period before updating the enrollment period', async () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    const periodInput = screen.getByLabelText('修課期別')
    expect(periodInput.value).toBe('16')
    expect(periodInput.type).toBe('number')
    expect(screen.getByLabelText('開始日期').value).toBe('2026-09-01')
    expect(screen.getByLabelText('結束日期').value).toBe('2026-12-31')

    fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-09-10' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(updateEnrollmentPeriod).toHaveBeenCalled())
    expect(updateEnrollmentPeriod.mock.calls[0][2]).toEqual({
      period: '第16期',
      period_start_date: '2026-09-10',
      period_end_date: '2026-12-31',
    })
  })

  it('rejects an invalid period before calling Supabase', () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('修課期別'), { target: { value: '' } })

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(updateEnrollmentPeriod).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('請輸入有效的期別，例如：第16期')
  })

  it('rejects reversed dates before calling Supabase', async () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-12-31' } })
    fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-09-01' } })

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('結束日期不能早於開始日期')
    expect(updateEnrollmentPeriod).not.toHaveBeenCalled()
  })

  it('displays an inline save error if service fails', async () => {
    const onSave = vi.fn()
    vi.mocked(updateEnrollmentPeriod).mockRejectedValueOnce(new Error('伺服器異常'))
    render(<EnrollmentEditForm enrollment={enrollment} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('伺服器異常')
    expect(onSave).not.toHaveBeenCalled()
  })
})
