import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnrollmentTab from './EnrollmentTab'

describe('EnrollmentTab', () => {
  afterEach(cleanup)

  it('opens the student matched by student_id when names are identical', () => {
    const students = [
      { student_id: '1', name: '王小明' },
      { student_id: '2', name: '王小明' }
    ]
    const onSelectEnrollment = vi.fn()

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
        onSelectEnrollment={onSelectEnrollment}
      />
    )

    fireEvent.click(screen.getByText('手機課').closest('tr'))

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(students[1], expect.objectContaining({ enrollment_id: 11 }))
  })

  it('reports the exact enrollment selected for the matched student', () => {
    const students = [{ student_id: '1', name: 'Student One' }]
    const enrollment = {
      enrollment_id: 99,
      student_id: '1',
      student_name: 'Student One',
      season: 'Season A',
      refunded: false,
      courses: ['Course A'],
    }
    const onSelectEnrollment = vi.fn()

    render(<EnrollmentTab students={students} enrollments={[enrollment]} onSelectEnrollment={onSelectEnrollment} />)

    fireEvent.click(screen.getByText('Course A').closest('tr'))

    expect(onSelectEnrollment).toHaveBeenCalledOnce()
    expect(onSelectEnrollment).toHaveBeenCalledWith(students[0], enrollment)
  })

  it('does not open another student when an enrollment student_id is missing', () => {
    const onSelectEnrollment = vi.fn()

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
        onSelectEnrollment={onSelectEnrollment}
      />
    )

    fireEvent.click(screen.getByText('肌力課').closest('tr'))

    expect(onSelectEnrollment).not.toHaveBeenCalled()
  })

  it('renders the compact history columns and read-only billing values', () => {
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
            amount: 1200,
            invoice_number: 'AB12345678',
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
            amount: 0,
            invoice_number: '',
            courses: ['Course B']
          },
          {
            enrollment_id: 15,
            student_id: '1',
            student_name: 'Student One',
            season: 'Season C',
            refunded: false,
            amount: null,
            invoice_number: null,
            courses: ['Course C']
          }
        ]}
        onSelectEnrollment={vi.fn()}
      />
    )

    const table = container.querySelector('table')
    const historyTable = within(table)

    expect(table.className).toBe('data-table')
    expect(historyTable.getAllByRole('columnheader').map(header => header.textContent)).toEqual([
      '姓名', '季別', '課程', '退費狀況', '金額', '發票編號'
    ])
    expect(historyTable.queryByText('Pre-test: 8')).toBeNull()
    expect(historyTable.queryByText('Post-test: 5')).toBeNull()

    expect(historyTable.queryByText('New')).toBeNull()
    expect(historyTable.queryByText('Returning')).toBeNull()

    const rows = historyTable.getAllByRole('row')
    expect(within(rows[1]).getAllByRole('cell').map(cell => cell.textContent)).toEqual([
      'Student One', 'Season A', 'Course A', '已退費', 'NT$ 1200', 'AB12345678'
    ])
    expect(within(rows[2]).getAllByRole('cell').map(cell => cell.textContent)).toEqual([
      'Student One', 'Season B', 'Course B', '正常', 'NT$ 0', '--'
    ])
    expect(within(rows[3]).getAllByRole('cell').map(cell => cell.textContent)).toEqual([
      'Student One', 'Season C', 'Course C', '正常', '--', '--'
    ])
  })

  it('keeps name/course, season, and refund filters without a registration filter', () => {
    render(
      <EnrollmentTab students={[]} enrollments={[
        { enrollment_id: 21, student_id: '1', student_name: 'Alice', season: 'Season A', reg_type: 'New', refunded: false, courses: ['Course A'] },
        { enrollment_id: 22, student_id: '2', student_name: 'Bob', season: 'Season B', reg_type: 'Returning', refunded: true, courses: ['Phone Course'] }
      ]} onSelectEnrollment={vi.fn()} />
    )

    expect(screen.queryByLabelText('新/續生')).toBeNull()
    fireEvent.change(screen.getByLabelText('搜尋姓名或課程'), { target: { value: 'Phone' } })
    expect(screen.getByText('Bob')).not.toBeNull()
    expect(screen.queryByText('Alice')).toBeNull()
    fireEvent.change(screen.getByLabelText('搜尋姓名或課程'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('篩選季別'), { target: { value: 'Season A' } })
    expect(screen.getByText('Alice')).not.toBeNull()
    expect(screen.queryByText('Bob')).toBeNull()
    fireEvent.change(screen.getByLabelText('篩選季別'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('退費狀況'), { target: { value: 'refunded' } })
    expect(screen.getByText('Bob')).not.toBeNull()
    expect(screen.queryByText('Alice')).toBeNull()
  })

  it('spans all history columns for an empty enrollment state', () => {
    render(
      <EnrollmentTab
        students={[]}
        enrollments={[]}
        onSelectEnrollment={vi.fn()}
      />
    )

    expect(screen.getByText('未找到選課歷程。').getAttribute('colspan')).toBe('6')
  })

  it('jumps directly between the first and last enrollment pages', () => {
    const enrollments = Array.from({ length: 21 }, (_, index) => ({
      enrollment_id: index + 1,
      student_id: String(index + 1),
      student_name: `Enrollment ${index + 1}`,
      season: 'Season A',
      reg_type: 'New',
      pre_test: '',
      post_test: '',
      refunded: false,
      courses: [`Course ${index + 1}`]
    }))

    render(
      <EnrollmentTab
        students={[]}
        enrollments={enrollments}
        onSelectEnrollment={vi.fn()}
      />
    )

    const firstPageButton = screen.getByRole('button', { name: '跳至最前頁' })
    const lastPageButton = screen.getByRole('button', { name: '跳至最尾頁' })

    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)

    fireEvent.click(lastPageButton)

    expect(screen.getByText('Enrollment 21')).not.toBeNull()
    expect(screen.queryByText('Enrollment 1')).toBeNull()
    expect(firstPageButton.disabled).toBe(false)
    expect(lastPageButton.disabled).toBe(true)

    fireEvent.click(firstPageButton)

    expect(screen.getByText('Enrollment 1')).not.toBeNull()
    expect(screen.queryByText('Enrollment 21')).toBeNull()
    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)
  })
})
