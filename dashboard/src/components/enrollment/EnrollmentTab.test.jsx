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

  it('renders notes while hiding score columns in the history table', () => {
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
            refund_info: 'Refund processed by card',
            courses: ['Course A']
          },
          {
            enrollment_id: 14,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season B',
            reg_type: 'Returning',
            pre_test: 'Pre-test: 0',
            post_test: 'Post-test: 6',
            refunded: false,
            refund_info: '',
            courses: ['Course B']
          },
          {
            enrollment_id: 15,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season C',
            reg_type: 'Returning',
            refunded: false,
            refund_info: null,
            courses: ['Course C']
          },
          {
            enrollment_id: 16,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season D',
            reg_type: 'Returning',
            refunded: false,
            refund_info: undefined,
            courses: ['Course D']
          }
        ]}
        onSelectStudent={vi.fn()}
      />
    )

    const table = container.querySelector('table')
    const historyTable = within(table)

    expect(table.className).toBe('data-table enrollment-history-table')
    expect(historyTable.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      '學員ID', '姓名', '修課期別', '新/續', '退費狀態', '選修課程', '備註'
    ])
    expect(historyTable.queryByRole('columnheader', { name: '前測分數' })).toBeNull()
    expect(historyTable.queryByRole('columnheader', { name: '後測分數' })).toBeNull()
    expect(historyTable.queryByText('Pre-test: 8')).toBeNull()
    expect(historyTable.queryByText('Post-test: 5')).toBeNull()
    expect(historyTable.getByText('Refund processed by card').closest('td').className).toBe('enrollment-history-note')
    expect(historyTable.getAllByText('--').map(note => note.closest('td').className)).toEqual([
      'enrollment-history-note',
      'enrollment-history-note',
      'enrollment-history-note'
    ])
  })
})
