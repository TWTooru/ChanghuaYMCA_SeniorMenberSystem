import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentInfoView from './StudentInfoView'
import EnrollmentTimeline from '../enrollment/EnrollmentTimeline'

const student = {
  student_id: 'S-001',
  name: '王小明',
  birth_date: '1960-01-01',
  age: 66,
  is_60_plus: '是',
  mobile_phone: '0912345678'
}

describe('Student detail components', () => {
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
})
