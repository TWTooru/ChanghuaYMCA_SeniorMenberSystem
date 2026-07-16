import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentInfoView from './StudentInfoView'
import EnrollmentTimeline from '../enrollment/EnrollmentTimeline'
import StudentDetailModal from './StudentDetailModal'

const authState = vi.hoisted(() => ({ role: 'viewer' }))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

const student = {
  student_id: 'S-001',
  name: '王小明',
  birth_date: '1960-01-01',
  age: 66,
  is_60_plus: '是',
  mobile_phone: '0912345678'
}
const enrollment = { enrollment_id: 1, student_id: student.student_id, season: '第十五季', courses: ['電腦課'] }

describe('Student detail components', () => {
  afterEach(() => {
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

    expect(screen.getByRole('tab', { name: '歷年參修（1 期）' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByText('第十五季')).not.toBeNull()
    expect(screen.queryByText('基本聯絡資料')).toBeNull()
    expect(container.querySelector('.student-detail-dialog')).not.toBeNull()
  })

  it('switches to profile without rendering history', () => {
    render(<StudentDetailModal student={student} enrollments={[enrollment]} initialTab="history" onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('tab', { name: '基本資料' }))

    expect(screen.getByText('基本聯絡資料')).not.toBeNull()
    expect(screen.queryByText('第十五季')).toBeNull()
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
    const historyTab = screen.getByRole('tab', { name: '歷年參修（0 期）' })
    historyTab.focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(historyTab)
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
    render(
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

    expect(screen.getByText('第十五季')).not.toBeNull()
    expect(screen.getByText('手機課')).not.toBeNull()
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
})
