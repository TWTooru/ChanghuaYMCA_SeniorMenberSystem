import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentEditForm from './StudentEditForm'
import EnrollmentEditForm from '../enrollment/EnrollmentEditForm'

const updateStudentResult = vi.hoisted(() => ({ error: null }))

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    rpc: async () => ({ data: null, error: updateStudentResult.error }),
    from: () => ({
      update: () => ({ eq: async () => updateStudentResult }),
    }),
  },
}))

const student = { student_id: 'S-001', name: '王小明', gender: '男', age: 66, is_60_plus: '是' }

afterEach(() => {
  cleanup()
  updateStudentResult.error = null
})

describe('Student detail edit forms', () => {
  it('prefills the student edit form from the selected student', () => {
    render(
      <StudentEditForm
        student={{ student_id: 'S-001', name: '王小明', gender: '男', age: 66, is_60_plus: '是' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('S-001').disabled).toBe(false)
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

  it('reports dirty state when a profile field changes', () => {
    const onDirtyChange = vi.fn()
    render(<StudentEditForm student={student} onSave={vi.fn()} onCancel={vi.fn()} onDirtyChange={onDirtyChange} />)

    fireEvent.change(screen.getByDisplayValue('王小明'), { target: { value: '王大明' } })
    expect(onDirtyChange).toHaveBeenLastCalledWith(true)
  })

  it('keeps the form and shows an inline save error', async () => {
    updateStudentResult.error = { message: '更新失敗' }
    const onSave = vi.fn()
    render(<StudentEditForm student={student} onSave={onSave} onCancel={vi.fn()} onDirtyChange={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
    expect((await screen.findByRole('alert')).textContent).toContain('更新失敗')
    expect(screen.getByDisplayValue(student.name)).not.toBeNull()
    expect(onSave).not.toHaveBeenCalled()
  })
})
