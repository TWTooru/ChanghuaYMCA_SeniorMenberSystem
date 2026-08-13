import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentListTab from './StudentListTab'

const authState = { role: 'editor' }

vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => authState }))

const students = [
  {
    student_id: 1, name: '王小明', gender: '男', email: 'ming@example.com', phone: '0912-345-678',
    birth_date: '1980-07-01', address: '台北市', organization: 'YMCA', education: '專科/大學',
  },
  {
    student_id: 2, name: '李小華', gender: '女', email: 'hua@example.com', phone: '0922-345-678',
    birth_date: '', address: '新北市', organization: '社區大學', education: '高中',
  },
]

describe('StudentListTab', () => {
  afterEach(cleanup)

  it('renders the final member columns and only gender and education filters', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    for (const label of ['ID', '姓名', '性別', '電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校', '教育程度']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('ming@example.com')).not.toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(2)
    expect(screen.queryByText(/年齡/)).toBeNull()
    expect(screen.queryByText(/60 歲/)).toBeNull()
    expect(screen.queryByText(/緊急聯絡人/)).toBeNull()
    expect(screen.queryByText(/職業/)).toBeNull()
  })

  it('searches email, phone, address, and organization case-insensitively', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)
    const search = screen.getByRole('textbox')

    fireEvent.change(search, { target: { value: 'HUA@EXAMPLE.COM' } })
    expect(screen.getByText('李小華')).not.toBeNull()
    expect(screen.queryByText('王小明')).toBeNull()

    fireEvent.change(search, { target: { value: 'YMCA' } })
    expect(screen.getByText('王小明')).not.toBeNull()
    expect(screen.queryByText('李小華')).toBeNull()
  })
})
