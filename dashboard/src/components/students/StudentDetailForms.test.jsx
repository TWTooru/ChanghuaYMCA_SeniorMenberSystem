import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentEditForm from './StudentEditForm'
import EnrollmentEditForm from '../enrollment/EnrollmentEditForm'

describe('Student detail edit forms', () => {
  it('prefills the student edit form from the selected student', () => {
    render(
      <StudentEditForm
        student={{ student_id: 'S-001', name: '王小明', gender: '男', age: 66, is_60_plus: '是' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('S-001').disabled).toBe(true)
    expect(screen.getByDisplayValue('王小明')).not.toBeNull()
    expect(screen.getByDisplayValue('是')).not.toBeNull()
  })

  it('prefills the enrollment edit form including its courses', () => {
    render(
      <EnrollmentEditForm
        enrollment={{ enrollment_id: 1, season: '第十五季', reg_type: '新', refunded: 0, courses: ['電腦課', '手機課'] }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('第十五季')).not.toBeNull()
    expect(screen.getByDisplayValue('電腦課, 手機課')).not.toBeNull()
  })
})
