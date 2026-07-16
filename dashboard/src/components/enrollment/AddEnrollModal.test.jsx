import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddEnrollModal from './AddEnrollModal'
import { createEnrollmentWithCourses } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({ createEnrollmentWithCourses: vi.fn() }))

const student = { student_id: 'S-001', name: '王小明' }

describe('AddEnrollModal', () => {
  beforeEach(() => vi.clearAllMocks())

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('normalizes a valid manual season label before creating enrollment', async () => {
    createEnrollmentWithCourses.mockResolvedValueOnce()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<AddEnrollModal student={student} onClose={vi.fn()} onRefresh={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('修課季度 *'), { target: { value: '第16期' } })
    fireEvent.change(screen.getByLabelText(/選修課程/), { target: { value: '肌力訓練' } })
    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalled())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({ season: '第十六季' })
  })

  it('initializes the season field from the supplied default', () => {
    render(<AddEnrollModal student={student} defaultSeason="第十六季" onClose={vi.fn()} onRefresh={vi.fn()} />)

    expect(screen.getByLabelText('修課季度 *').value).toBe('第十六季')
  })

  it('rejects an invalid manual season label before creating enrollment', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {})
    render(<AddEnrollModal student={student} onClose={vi.fn()} onRefresh={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('修課季度 *'), { target: { value: '春季班' } })
    fireEvent.change(screen.getByLabelText(/選修課程/), { target: { value: '肌力訓練' } })
    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    expect(createEnrollmentWithCourses).not.toHaveBeenCalled()
    expect(alert).toHaveBeenCalledWith('請輸入有效的季度，例如：第十六季')
  })
})
