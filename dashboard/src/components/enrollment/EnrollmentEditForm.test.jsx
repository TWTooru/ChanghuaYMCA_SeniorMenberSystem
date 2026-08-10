import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnrollmentEditForm from './EnrollmentEditForm'
import { fetchCourseCatalog } from '../../services/courseCatalogService'
import { updateEnrollmentWithCourses } from '../../services/enrollmentService'

vi.mock('../../services/enrollmentService', () => ({ updateEnrollmentWithCourses: vi.fn() }))
vi.mock('../../services/courseCatalogService', () => ({
  deactivateCourseCatalogEntry: vi.fn(),
  fetchCourseCatalog: vi.fn(),
  saveCourseCatalogEntry: vi.fn(),
}))

const enrollment = {
  enrollment_id: 1,
  season: '第16期',
  reg_type: '新',
  refunded: 0,
  courses: ['電腦課', '手機課'],
  courseDetails: [
    { courseId: 10, courseName: '電腦課', receipt: { receiptId: 20, amount: null, invoiceNumber: null } },
    { courseId: 11, courseName: '手機課', receipt: null },
  ],
}

describe('EnrollmentEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.mocked(fetchCourseCatalog).mockResolvedValue([
      { courseCatalogId: 1, courseName: '電腦課', active: true },
      { courseCatalogId: 2, courseName: '手機課', active: true },
    ])
    vi.mocked(updateEnrollmentWithCourses).mockResolvedValue()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('canonicalizes a valid season before updating the enrollment', async () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(updateEnrollmentWithCourses).toHaveBeenCalled())
    expect(updateEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      season: '第十六季',
      courses: ['電腦課', '手機課'],
    })
  })

  it('rejects an invalid season before calling Supabase', () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)
    fireEvent.change(screen.getByDisplayValue('第16期'), { target: { value: '春季班' } })

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect(updateEnrollmentWithCourses).not.toHaveBeenCalled()
    expect(window.alert).toHaveBeenCalledWith('請輸入有效的季度，例如：第十六季')
  })

  it('renders selected tags and locks only a course with a receipt', async () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    const lockedCourse = await screen.findByRole('button', { name: /電腦課/ })
    const removableCourse = screen.getByRole('button', { name: '手機課' })
    expect(screen.queryByDisplayValue('電腦課, 手機課')).toBeNull()
    expect(lockedCourse.disabled).toBe(true)
    expect(lockedCourse.textContent).toContain('已開立收據')
    expect(removableCourse.getAttribute('aria-pressed')).toBe('true')

    fireEvent.click(removableCourse)
    expect(removableCourse.disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(updateEnrollmentWithCourses).toHaveBeenCalled())
    expect(updateEnrollmentWithCourses.mock.calls[0][2].courses).toEqual(['電腦課'])
  })

  it('locks courses linked by billingReceiptId', async () => {
    const groupedBillingEnrollment = {
      ...enrollment,
      courseDetails: [
        { courseId: 10, courseName: enrollment.courses[0], billingReceiptId: 100 },
        { courseId: 11, courseName: enrollment.courses[1], billingReceiptId: null },
      ],
    }
    const { container } = render(<EnrollmentEditForm enrollment={groupedBillingEnrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    await waitFor(() => expect(container.querySelectorAll('.course-tag-picker-tag')).toHaveLength(2))
    const [lockedCourse, removableCourse] = container.querySelectorAll('.course-tag-picker-tag')

    expect(lockedCourse.disabled).toBe(true)
    expect(removableCourse.disabled).toBe(false)
  })

  it('keeps selected tags retryable and displays an inline save error', async () => {
    const onSave = vi.fn()
    vi.mocked(updateEnrollmentWithCourses).mockRejectedValueOnce(new Error('已有收據的課程不能移除'))
    render(<EnrollmentEditForm enrollment={enrollment} onSave={onSave} onCancel={vi.fn()} />)

    const removableCourse = await screen.findByRole('button', { name: '手機課' })
    fireEvent.click(removableCourse)
    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    expect((await screen.findByRole('alert')).textContent).toContain('已有收據的課程不能移除')
    expect(screen.getByRole('button', { name: /電腦課/ }).disabled).toBe(true)
    expect(screen.getByRole('button', { name: '手機課' }).getAttribute('aria-pressed')).toBe('false')
    expect(onSave).not.toHaveBeenCalled()
  })
})
