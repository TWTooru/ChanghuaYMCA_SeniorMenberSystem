import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentEditForm from './StudentEditForm'
import EnrollmentEditForm from '../enrollment/EnrollmentEditForm'
import { fetchCourseCatalog } from '../../services/courseCatalogService'

const updateStudentResult = vi.hoisted(() => ({ error: null }))

vi.mock('../../services/courseCatalogService', () => ({
  deactivateCourseCatalogEntry: vi.fn(),
  fetchCourseCatalog: vi.fn().mockResolvedValue([
    { courseCatalogId: 1, courseName: '電腦課', active: true },
    { courseCatalogId: 2, courseName: '手機課', active: true },
  ]),
  saveCourseCatalogEntry: vi.fn(),
}))

vi.mock('../../lib/supabaseClient', () => ({
  // 服務層 mock 僅模擬表單所需的回應，不載入實際的 Supabase 用戶端。
  supabase: {
    rpc: async () => ({ data: null, error: updateStudentResult.error }),
    from: () => ({
      update: () => ({ eq: async () => updateStudentResult }),
    }),
  },
}))

const student = { student_id: 1, name: '王小明', gender: '男', education: '專科/大學' }

afterEach(() => {
  cleanup()
  updateStudentResult.error = null
  vi.mocked(fetchCourseCatalog).mockClear()
})

describe('Student detail edit forms', () => {
  it('edits only final member profile fields', () => {
    render(<StudentEditForm student={{
      student_id: 12, email: 'member@example.com', name: '王小明', gender: '男', phone: '0912-345-678',
      birth_date: '1980-07-01', address: '台北市', organization: 'YMCA', education: '專科/大學',
    }} onSave={vi.fn()} onCancel={vi.fn()} />)

    for (const label of ['ID', '電子郵件', '姓名', '性別', '電話', '出生年月日', '通訊處', '服務機關 / 學校', '教育程度']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
    expect(screen.queryByLabelText(/年齡/)).toBeNull()
    expect(screen.queryByLabelText(/60 歲/)).toBeNull()
    expect(screen.queryByLabelText(/緊急聯絡人/)).toBeNull()
  })

  it('prefills the student edit form from the selected student', () => {
    render(
      <StudentEditForm
        student={{ student_id: 1, name: '王小明', gender: '男', education: '專科/大學' }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('1').disabled).toBe(false)
    expect(screen.getByDisplayValue('王小明')).not.toBeNull()
  })

  it('prefills the enrollment edit form including its course tags', async () => {
    render(
      <EnrollmentEditForm
        enrollment={{ enrollment_id: 1, period: '第15期', reg_type: '新', refunded: 0, courses: ['電腦課', '手機課'] }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByDisplayValue('第15期')).not.toBeNull()
    expect(await screen.findByRole('button', { name: '電腦課' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '手機課' })).not.toBeNull()
    expect(screen.queryByDisplayValue('電腦課, 手機課')).toBeNull()
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
