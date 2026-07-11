import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EnrollmentTab from './EnrollmentTab'

describe('EnrollmentTab', () => {
  it('opens the student matched by student_id when names are identical', () => {
    const students = [
      { student_id: '1', name: '王小明' },
      { student_id: '2', name: '王小明' }
    ]
    const onSelectStudent = vi.fn()

    render(
      <EnrollmentTab
        students={students}
        enrollments={[
          {
            enrollment_id: 11,
            student_id: 2,
            student_name: '王小明',
            season: '第十五期',
            reg_type: '續',
            refunded: false,
            courses: ['手機課']
          }
        ]}
        onSelectStudent={onSelectStudent}
      />
    )

    fireEvent.click(screen.getByText('手機課').closest('tr'))

    expect(onSelectStudent).toHaveBeenCalledOnce()
    expect(onSelectStudent).toHaveBeenCalledWith(students[1])
  })

  it('does not open another student when an enrollment student_id is missing', () => {
    const onSelectStudent = vi.fn()

    render(
      <EnrollmentTab
        students={[{ student_id: '1', name: '王小明' }]}
        enrollments={[
          {
            enrollment_id: 12,
            student_id: '999',
            student_name: '王小明',
            season: '第十五期',
            reg_type: '續',
            refunded: false,
            courses: ['肌力課']
          }
        ]}
        onSelectStudent={onSelectStudent}
      />
    )

    fireEvent.click(screen.getByText('肌力課').closest('tr'))

    expect(onSelectStudent).not.toHaveBeenCalled()
  })
})
