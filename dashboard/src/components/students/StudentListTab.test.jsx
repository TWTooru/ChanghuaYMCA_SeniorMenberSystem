import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  {
    student_id: 3, name: '陳小美', gender: '女', email: 'mei@example.com', phone: '0933-345-678',
    birth_date: '1990-01-01', address: '台中市', organization: 'YMCA', education: '碩士',
  }
]

describe('StudentListTab', () => {
  afterEach(cleanup)

  it('renders the final member columns and only gender and education filters', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    for (const label of ['ID', '姓名', '性別', '電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校', '教育程度']) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    expect(screen.getByText('ming@example.com')).not.toBeNull()
    expect(screen.getAllByRole('combobox')).toHaveLength(3) // gender, edu, page size
  })

  it('searches email, phone, address, and organization with debounce', async () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)
    const search = screen.getByRole('textbox')

    fireEvent.change(search, { target: { value: 'HUA@EXAMPLE.COM' } })
    await waitFor(() => {
      expect(screen.getByText('李小華')).not.toBeNull()
      expect(screen.queryByText('王小明')).toBeNull()
    })

    fireEvent.change(search, { target: { value: 'YMCA' } })
    await waitFor(() => {
      expect(screen.getByText('王小明')).not.toBeNull()
      expect(screen.getByText('陳小美')).not.toBeNull()
      expect(screen.queryByText('李小華')).toBeNull()
    })
  })

  it('supports sorting by ID and Name', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)
    
    // Check initial order by ID asc
    let rows = screen.getAllByRole('row').slice(1) // skip header
    expect(rows[0].textContent).toContain('王小明')
    expect(rows[1].textContent).toContain('李小華')
    expect(rows[2].textContent).toContain('陳小美')

    // Click ID to sort desc
    const idHeader = screen.getAllByText('ID')[0]
    fireEvent.click(idHeader)
    rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('陳小美')

    // Click Name to sort
    const nameHeader = screen.getAllByText('姓名')[0]
    fireEvent.click(nameHeader) // default sort by string asc
    rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('王小明') // 王, 李, 陳
    expect(rows[1].textContent).toContain('李小華')
    expect(rows[2].textContent).toContain('陳小美')

    // Click Name again to sort desc
    fireEvent.click(nameHeader)
    rows = screen.getAllByRole('row').slice(1)
    expect(rows[0].textContent).toContain('陳小美')
  })

  it('changes items per page', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)
    
    const pageSizeSelect = screen.getAllByRole('combobox').find(select => select.innerHTML.includes('10 筆/頁'))
    expect(pageSizeSelect).not.toBeUndefined()
    
    // Can change page size
    fireEvent.change(pageSizeSelect, { target: { value: '20' } })
    expect(screen.getByText(/顯示第 1 至 3 筆會員/)).not.toBeNull()
  })
})
