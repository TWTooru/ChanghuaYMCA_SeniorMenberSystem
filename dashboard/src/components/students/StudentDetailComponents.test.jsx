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

describe('Student detail components', () => {
  afterEach(cleanup)
  it('renders the student contact details', () => {
    render(<StudentInfoView student={student} />)

    expect(screen.getByText('基本聯絡資料')).not.toBeNull()
    expect(screen.getByText(/1960-01-01/)).not.toBeNull()
    expect(screen.getByText('0912345678')).not.toBeNull()
  })

  it('shows enrollment details and delegates adding an enrollment', () => {
    const onAddEnrollment = vi.fn()
    render(
      <EnrollmentTimeline
        timeline={[{ enrollment_id: 1, season: '第十五期', reg_type: '新', courses: ['電腦課'] }]}
        onAddEnrollment={onAddEnrollment}
      />
    )

    expect(screen.getByText('第十五期')).not.toBeNull()
    expect(screen.getByText('電腦課')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /新增選課紀錄/ }))
    expect(onAddEnrollment).toHaveBeenCalledOnce()
  })

  it('shows only enrollments belonging to the selected student_id when names match', () => {
    render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', student_name: '王小明', season: '第十四期', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', student_name: '王小明', season: '第十五期', courses: ['手機課'] }
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText('第十五期')).not.toBeNull()
    expect(screen.getByText('手機課')).not.toBeNull()
    expect(screen.queryByText('第十四期')).toBeNull()
    expect(screen.queryByText('電腦課')).toBeNull()
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
})
