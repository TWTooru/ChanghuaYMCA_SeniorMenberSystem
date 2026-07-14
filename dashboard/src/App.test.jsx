import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const apiDataSpy = vi.fn(() => ({
  dbData: { students: [], enrollments: [] },
  dbStatus: 'connected',
  dbError: null,
}))

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
vi.mock('./components/students/StudentListTab', () => ({ default: () => null }))
vi.mock('./components/enrollment/EnrollmentTab', () => ({ default: () => null }))
vi.mock('./components/students/StudentDetailModal', () => ({ default: () => null }))
vi.mock('./components/students/AddStudentModal', () => ({ default: () => null }))
vi.mock('./components/enrollment/AddEnrollModal', () => ({ default: () => null }))
vi.mock('./components/sync/ExcelSync', () => ({ default: () => <div data-testid="excel-sync" /> }))
vi.mock('./components/auth/Login', () => ({ default: () => null }))
vi.mock('./components/auth/PasswordSetup', () => ({ default: () => <div data-testid="password-setup" /> }))
vi.mock('./lib/excelExport', () => ({ exportToExcel: vi.fn() }))

describe('App header access controls', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.role = 'viewer'
    authState.passwordFlow = null
    signOut.mockClear()
    apiDataSpy.mockClear()
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
})
