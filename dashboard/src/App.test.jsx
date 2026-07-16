import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

let apiData = {
  dbData: { students: [], enrollments: [] },
  dbStatus: 'connected',
  dbError: null,
}
const apiDataSpy = vi.fn(() => apiData)
const studentDetailModalSpy = vi.hoisted(() => vi.fn())

const signOut = vi.fn()
const authState = {
  session: { access_token: 'test-token' },
  user: { email: 'viewer@example.com' },
  role: 'viewer',
  passwordFlow: null,
  completePasswordFlow: vi.fn(),
  signOut,
}

vi.mock('./contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

vi.mock('./hooks/useApiData', () => ({
  default: (...args) => apiDataSpy(...args),
}))

vi.mock('./components/overview/OverviewTab', () => ({ default: () => null }))
vi.mock('./components/students/StudentListTab', () => ({
  default: ({ students, onSelectStudent }) => students[0]
    ? <button type="button" onClick={() => onSelectStudent(students[0], 'profile')}>open first student</button>
    : null,
}))
vi.mock('./components/enrollment/EnrollmentTab', () => ({ default: () => null }))
vi.mock('./components/students/StudentDetailModal', () => ({
  default: ({ student }) => {
    studentDetailModalSpy(student)
    return <div data-testid="student-detail-modal">{student.name}</div>
  },
}))
vi.mock('./components/students/AddStudentModal', () => ({ default: () => null }))
vi.mock('./components/enrollment/AddEnrollModal', () => ({ default: () => null }))
vi.mock('./components/sync/ExcelSync', () => ({ default: () => <div data-testid="excel-sync" /> }))
vi.mock('./components/auth/Login', () => ({ default: () => null }))
vi.mock('./components/auth/PasswordSetup', () => ({ default: () => <div data-testid="password-setup" /> }))
vi.mock('./components/admin/AdminAccountPage', () => ({ default: () => <div data-testid="admin-account-page" /> }))
vi.mock('./lib/excelExport', () => ({ exportToExcel: vi.fn() }))
vi.mock('./components/sync/ExportOptionsDialog', () => ({ default: ({ onExport }) => <div data-testid="export-modal" onClick={() => onExport({ exportScope: 'all', selectedSeason: null, options: {} })} /> }))

describe('App header access controls', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.role = 'viewer'
    authState.passwordFlow = null
    signOut.mockClear()
    apiDataSpy.mockClear()
    studentDetailModalSpy.mockClear()
    apiData = {
      dbData: { students: [], enrollments: [] },
      dbStatus: 'connected',
      dbError: null,
    }
  })

  it('shows the signed-in user email and role badge', () => {
    render(<App />)

    expect(screen.getByText('viewer@example.com')).toBeTruthy()
    expect(document.querySelector('.header-role-badge')?.textContent).toBe('檢視者')
  })

  it('signs out when the logout button is pressed', () => {
    render(<App />)

    fireEvent.click(screen.getByTitle('登出'))
    expect(signOut).toHaveBeenCalledOnce()
  })

  it('hides Excel sync and refresh controls from viewers', () => {
    render(<App />)

    expect(screen.queryAllByTestId('excel-sync')).toHaveLength(0)
    expect(document.querySelector('.btn-secondary')).toBeNull()
  })

  it.each(['editor', 'admin'])('%s can see Excel sync and refresh controls', (role) => {
    authState.role = role
    render(<App />)

    expect(screen.queryAllByTestId('excel-sync')).toHaveLength(1)
    expect(document.querySelector('.btn-secondary')).toBeTruthy()
  })

  it('shows account management navigation only to admins', () => {
    const { rerender } = render(<App />)

    expect(document.querySelector('#tab-admin')).toBeNull()

    authState.role = 'admin'
    rerender(<App />)

    expect(document.querySelector('#tab-admin')).toBeTruthy()
  })

  it('leaves account management immediately after role downgrade', () => {
    authState.role = 'admin'
    const { rerender } = render(<App />)

    fireEvent.click(document.querySelector('#tab-admin'))
    expect(screen.getByTestId('admin-account-page')).toBeTruthy()

    authState.role = 'viewer'
    rerender(<App />)

    expect(screen.queryByTestId('admin-account-page')).toBeNull()
    expect(document.querySelector('#tab-overview')?.classList.contains('active')).toBe(true)
  })

  it.each([
    ['a missing role', undefined],
    ['an unknown role', 'unknown-role'],
  ])('defaults %s to viewer UI', (_description, role) => {
    authState.role = role
    render(<App />)

    expect(document.querySelector('.header-role-badge')?.textContent).toBe('檢視者')
    expect(screen.queryAllByTestId('excel-sync')).toHaveLength(0)
    expect(document.querySelector('.btn-secondary')).toBeNull()
  })

  it('renders password setup before mounting authenticated dashboard data', () => {
    authState.passwordFlow = 'invite'

    render(<App />)

    expect(screen.getByTestId('password-setup')).toBeTruthy()
    expect(apiDataSpy).not.toHaveBeenCalled()
  })

  it('opens export options dialog when download Excel is clicked', () => {
    authState.role = 'admin'
    render(<App />)
    expect(screen.queryByTestId('export-modal')).toBeNull()
    fireEvent.click(screen.getByText('下載整理版 Excel'))
    expect(screen.getByTestId('export-modal')).toBeTruthy()
  })

  it('keeps an open student detail synchronized after refreshed data replaces that student', () => {
    const selectedStudent = { student_id: 'S-001', name: '王小明' }
    const refreshedStudent = { student_id: 'S-001', name: '王大明' }
    apiData = { dbData: { students: [selectedStudent], enrollments: [] }, dbStatus: 'connected', dbError: null }
    const { rerender } = render(<App />)

    fireEvent.click(document.querySelector('#tab-students'))
    fireEvent.click(screen.getByRole('button', { name: 'open first student' }))
    expect(screen.getByTestId('student-detail-modal').textContent).toBe('王小明')

    apiData = { dbData: { students: [refreshedStudent], enrollments: [] }, dbStatus: 'connected', dbError: null }
    rerender(<App />)

    expect(screen.getByTestId('student-detail-modal').textContent).toBe('王大明')
    expect(studentDetailModalSpy).toHaveBeenLastCalledWith(refreshedStudent)
  })
})
