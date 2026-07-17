import { fireEvent, render, screen, within } from '@testing-library/react'
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
            season: '第十五季',
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
            season: '第十五季',
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

  it('renders pre-test and post-test scores in the history table', () => {
    const { container } = render(
      <EnrollmentTab
        students={[{ student_id: '1', name: 'Student One' }]}
        enrollments={[
          {
            enrollment_id: 13,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season A',
            reg_type: 'New',
            pre_test: 'Pre-test: 8',
            post_test: 'Post-test: 5',
            refunded: true,
            courses: ['Course A']
          },
          {
            enrollment_id: 14,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season B',
            reg_type: 'Returning',
            pre_test: '',
            post_test: '',
            refunded: false,
            courses: ['Course B']
          }
        ]}
        onSelectStudent={vi.fn()}
      />
    )

    const table = container.querySelector('table')
    const historyTable = within(table)

    expect(table.className).toBe('data-table')
    expect(historyTable.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      '學員ID', '姓名', '修課期別', '新/續', '前測分數', '後測分數', '退費狀態', '選修課程'
    ])
    expect(historyTable.getByText('Pre-test: 8')).not.toBeNull()
    expect(historyTable.getByText('Post-test: 5')).not.toBeNull()
  })

  it('spans all history columns for an empty enrollment state', () => {
    render(
      <EnrollmentTab
        students={[]}
        enrollments={[]}
        onSelectStudent={vi.fn()}
      />
    )

    expect(screen.getByText('未找到選課歷程。').getAttribute('colspan')).toBe('8')
  })
})
