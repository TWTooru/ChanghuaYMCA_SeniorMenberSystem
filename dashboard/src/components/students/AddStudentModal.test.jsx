import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AddStudentModal from './AddStudentModal'

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../../services/studentService', () => ({ createStudent: vi.fn() }))

describe('AddStudentModal', () => {
  afterEach(cleanup)

  it('renders only the final member profile fields with required name, gender, and education', () => {
    render(<AddStudentModal students={[]} onClose={vi.fn()} onRefresh={vi.fn()} />)

    expect(screen.getByLabelText('ID（選填）').required).toBe(false)
    expect(screen.getByLabelText('姓名').required).toBe(true)
    expect(screen.getByLabelText('性別').required).toBe(true)
    expect(screen.getByLabelText('教育程度').required).toBe(true)
    for (const label of ['電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校']) {
      expect(screen.getByLabelText(label)).not.toBeNull()
    }
    expect(screen.queryByLabelText(/年齡/)).toBeNull()
    expect(screen.queryByLabelText(/緊急聯絡人/)).toBeNull()
    expect(screen.queryByLabelText(/職業/)).toBeNull()
  })
})
