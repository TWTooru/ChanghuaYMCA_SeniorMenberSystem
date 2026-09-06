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

  it('filters members through the gender menu', async () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    fireEvent.click(screen.getByRole('combobox', { name: '性別' }))
    const femaleOption = await screen.findByRole('option', { name: '女' })
    fireEvent.pointerDown(femaleOption, { pointerType: 'mouse' })
    fireEvent.click(femaleOption)

    await waitFor(() => {
      expect(screen.queryByText('王小明')).toBeNull()
      expect(screen.getByText('李小華')).not.toBeNull()
      expect(screen.getByText('陳小美')).not.toBeNull()
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

  it('makes sortable columns keyboard accessible and announces the active direction', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    const idSort = screen.getByRole('button', { name: '依 ID 排序' })
    const nameSort = screen.getByRole('button', { name: '依姓名排序' })

    expect(idSort.closest('th')?.getAttribute('aria-sort')).toBe('ascending')
    expect(nameSort.closest('th')?.getAttribute('aria-sort')).toBe('none')

    fireEvent.click(nameSort)

    expect(idSort.closest('th')?.getAttribute('aria-sort')).toBe('none')
    expect(nameSort.closest('th')?.getAttribute('aria-sort')).toBe('ascending')
  })

  it('opens a member profile from a named keyboard-accessible control', () => {
    const onSelectStudent = vi.fn()
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={onSelectStudent} onShowAddStudent={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: '查看王小明會員資料' }))

    expect(onSelectStudent).toHaveBeenCalledWith(students[0], 'profile')
    expect(onSelectStudent).toHaveBeenCalledTimes(1)
  })

  it('gives every pagination control an accessible name', () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    expect(screen.getByRole('button', { name: '跳至最前頁' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '上一頁' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '第 1 頁' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('button', { name: '下一頁' })).not.toBeNull()
    expect(screen.getByRole('button', { name: '跳至最尾頁' })).not.toBeNull()
  })

  it('changes items per page through a labelled control', async () => {
    render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} onShowAddStudent={vi.fn()} />)

    fireEvent.click(screen.getByRole('combobox', { name: '每頁筆數' }))
    const twentyPerPage = await screen.findByRole('option', { name: '20 筆/頁' })
    fireEvent.pointerDown(twentyPerPage, { pointerType: 'mouse' })
    fireEvent.click(twentyPerPage)

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: '每頁筆數' }).textContent).toContain('20 筆/頁')
    })
    expect(screen.getByText(/顯示第 1 至 3 筆會員/)).not.toBeNull()
  })
})
