import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentInfoView from './StudentInfoView'
import EnrollmentTimeline from '../enrollment/EnrollmentTimeline'
import StudentDetailModal from './StudentDetailModal'

const testDirectory = dirname(fileURLToPath(import.meta.url))
const commonStyles = readFileSync(resolve(testDirectory, '../common/common.css'), 'utf8')
const studentStyles = readFileSync(resolve(testDirectory, './students.css'), 'utf8')

const authState = vi.hoisted(() => ({ role: 'viewer' }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

const student = {
  // 共用 fixture 以固定學員資料，讓焦點與未儲存變更測試能專注驗證對話框生命週期。
  student_id: 'S-001',
  name: '王小明',
  birth_date: '1960-01-01',
  age: 66,
  is_60_plus: '是',
  mobile_phone: '0912345678'
}
const enrollment = { enrollment_id: 1, student_id: student.student_id, season: '第十五季', courses: ['電腦課'] }

describe('Student detail components', () => {
  let styleElement

  beforeEach(() => {
    styleElement = document.createElement('style')
    styleElement.textContent = `${commonStyles}\n${studentStyles}`
    document.head.append(styleElement)
  })

  afterEach(() => {
    styleElement.remove()
    authState.role = 'viewer'
    cleanup()
  })
  it('renders the student contact details', () => {
    render(<StudentInfoView student={student} />)

    expect(screen.getByText('基本聯絡資料')).not.toBeNull()
    expect(screen.getByText(/1960-01-01/)).not.toBeNull()
    expect(screen.getByText('0912345678')).not.toBeNull()
  })

  it('opens history by default and renders only the active folder', () => {
    const { container } = render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="history" onClose={vi.fn()} />)

    expect(screen.getByRole('tab', { name: '歷年修課（1 期）' }).getAttribute('aria-selected')).toBe('true')
    expect(within(container.querySelector('.timeline-section')).getByText('第十五季')).not.toBeNull()
    expect(screen.queryByText('基本聯絡資料')).toBeNull()
    expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
  })

  it('switches to profile without rendering history', () => {
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="history" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: '基本資料' }))

    expect(screen.getByText('基本聯絡資料')).not.toBeNull()
    expect(screen.queryByText('第十五季')).toBeNull()
  })

  it('uses the student detail body as the only vertical scroll container while editing', () => {
    authState.role = 'admin'
    const { container } = render(
      <StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={vi.fn()} />
    )

    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))

    const detailBody = container.querySelector('.student-detail-body')
    const editGrid = detailBody.querySelector('.form-grid')
    expect(getComputedStyle(detailBody).overflowY).toBe('auto')
    expect(getComputedStyle(editGrid).overflowY).toBe('visible')
  })

  it('closes with Escape and restores focus to the opener', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const onClose = vi.fn()
    const { unmount } = render(<StudentDetailModal student={student} enrollments={[]} onClose={onClose} />)

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
  })

  it('keeps Tab navigation inside the dialog', () => {
    render(<StudentDetailModal student={student} enrollments={[]} onClose={vi.fn()} />)

    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: '關閉學員資料' })
    const historyTab = screen.getByRole('tab', { name: '歷年修課（0 期）' })
    historyTab.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(historyTab)
  })

  it('guards tab changes when profile edits are unsaved', () => {
    authState.role = 'admin'
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="profile" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    fireEvent.click(screen.getByRole('tab', { name: '歷年修課（1 期）' }))

    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(screen.getByDisplayValue('王大明')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }))
    expect(screen.getByDisplayValue('王大明')).not.toBeNull()
  })

  it('discards edits and performs the pending close', () => {
    const onClose = vi.fn()
    authState.role = 'admin'
    const { container } = render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    fireEvent.click(container.querySelector('#btn-close-modal'))
    fireEvent.click(screen.getByRole('button', { name: '放棄變更' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('guards overlay and Escape dismissal when profile edits are unsaved', () => {
    const onClose = vi.fn()
    authState.role = 'admin'
    const { container } = render(<StudentDetailModal student={student} enrollments={[]} initialTab="profile" onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })

    fireEvent.click(container.querySelector('#modal-overlay'))
    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '繼續編輯' }))

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(screen.getByText('尚有未儲存變更')).not.toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('shows enrollment details and delegates adding an enrollment', () => {
    const onAddEnrollment = vi.fn()
    render(
      <EnrollmentTimeline
        timeline={[{ enrollment_id: 1, season: '第十五季', reg_type: '新', courses: ['電腦課'] }]}
        onAddEnrollment={onAddEnrollment}
      />
    )

    expect(screen.getByText('第十五季')).not.toBeNull()
    expect(screen.getByText('電腦課')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /新增選課紀錄/ }))
    expect(onAddEnrollment).toHaveBeenCalledOnce()
  })

  it('shows only enrollments belonging to the selected student_id when names match', () => {
    const { container } = render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', student_name: '王小明', season: '第十四季', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', student_name: '王小明', season: '第十五季', courses: ['手機課'] }
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    const timeline = within(container.querySelector('.timeline-section'))
    expect(timeline.getByText('第十五季')).not.toBeNull()
    expect(timeline.getByText('手機課')).not.toBeNull()
    expect(screen.queryByText('第十四季')).toBeNull()
    expect(screen.queryByText('電腦課')).toBeNull()
  })

  it('sorts the timeline by numeric season order', () => {
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[
          { enrollment_id: 1, student_id: student.student_id, season: '第十六季', courses: ['較晚課程'] },
          { enrollment_id: 2, student_id: student.student_id, season: '第十五季', courses: ['較早課程'] },
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(container.querySelector('.timeline-container').textContent.indexOf('第十五季')).toBeLessThan(container.querySelector('.timeline-container').textContent.indexOf('第十六季'))
  })

  it('hides student and enrollment mutation controls from viewers', () => {
    authState.role = 'viewer'
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[{ enrollment_id: 1, student_id: student.student_id, season: 'Season A', courses: [] }]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(container.querySelector('.btn-edit')).toBeNull()
    expect(container.querySelector('.btn-delete')).toBeNull()
    expect(container.querySelector('#btn-add-enrollment-modal')).toBeNull()
    expect(container.querySelector('.timeline-action-btn')).toBeNull()
  })

  it('hides disabled enrollment controls while preserving permitted edit controls', () => {
    const { container } = render(
      <EnrollmentTimeline
        timeline={[{ enrollment_id: 1, season: 'Season A', courses: [] }]}
        onAddEnrollment={null}
        onDelete={null}
        onEditEnrollment={true}
      />
    )

    expect(container.querySelector('#btn-add-enrollment-modal')).toBeNull()
    expect(container.querySelector('.timeline-action-btn')).not.toBeNull()
    expect(container.querySelector('.timeline-action-btn.danger')).toBeNull()
  })

  it('closes a student edit form when the current role loses edit permission', () => {
    authState.role = 'admin'
    const props = {
      student,
      enrollments: [],
      onClose: vi.fn(),
      onAddEnrollment: vi.fn(),
      onRefresh: vi.fn(),
    }
    const { container, rerender } = render(<StudentDetailModal {...props} initialTab="profile" />)

    fireEvent.click(container.querySelector('.btn-edit'))
    expect(container.querySelector('input[name="name"]')).not.toBeNull()

    authState.role = 'viewer'
    rerender(<StudentDetailModal {...props} initialTab="profile" />)

    expect(container.querySelector('input[name="name"]')).toBeNull()
  })

  it('closes open student and enrollment deletion confirmations when delete permission is removed', () => {
    authState.role = 'admin'
    const props = {
      student,
      enrollments: [{ enrollment_id: 1, student_id: student.student_id, season: 'Season A', courses: [] }],
      onClose: vi.fn(),
      onAddEnrollment: vi.fn(),
      onRefresh: vi.fn(),
    }
    const { container, rerender } = render(<StudentDetailModal {...props} />)

    fireEvent.click(container.querySelector('.btn-delete'))
    expect(container.querySelector('.modal-overlay-center')).not.toBeNull()

    authState.role = 'editor'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()

    authState.role = 'admin'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()
    fireEvent.click(container.querySelector('.timeline-action-btn.danger'))
    expect(container.querySelector('.modal-overlay-center')).not.toBeNull()

    authState.role = 'editor'
    rerender(<StudentDetailModal {...props} />)
    expect(container.querySelector('.modal-overlay-center')).toBeNull()
  })

  it('closes an enrollment edit form when edit permission is removed', () => {
    const timeline = [{ enrollment_id: 1, season: 'Season A', courses: [] }]
    const { container, rerender } = render(
      <EnrollmentTimeline timeline={timeline} onEditEnrollment={true} />
    )

    fireEvent.click(container.querySelector('.timeline-action-btn'))
    expect(container.querySelector('.enrollment-edit-form')).not.toBeNull()

    rerender(<EnrollmentTimeline timeline={timeline} onEditEnrollment={false} />)
    expect(container.querySelector('.enrollment-edit-form')).toBeNull()
  })

  it('renders the selected student trend before the enrollment timeline', () => {
    const { container } = render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', season: '第十五季', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', season: '第十五季', courses: ['手機課'] },
          { enrollment_id: 3, student_id: 'S-002', season: '第十六季', courses: ['手機課'] },
        ]}
        onClose={vi.fn()}
      />
    )

    const trend = container.querySelector('.student-course-trend')
    const timeline = container.querySelector('.timeline-section')
    expect(trend).not.toBeNull()
    expect(trend.textContent).toContain('手機課')
    expect(trend.textContent).toContain('2 次')
    expect(trend.textContent).not.toContain('電腦課')
    expect(trend.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('also renders the trend in the non-tabbed history layout', () => {
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[enrollment]}
        isTabbed={false}
        onClose={vi.fn()}
      />
    )

    expect(container.querySelector('.student-course-trend')).not.toBeNull()
    expect(screen.getByRole('heading', { name: '學生選課趨勢圖' })).not.toBeNull()
  })
})
