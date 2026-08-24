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
const billingDetailModalSpy = vi.hoisted(() => vi.fn())

const signOut = vi.fn()
const refreshRole = vi.fn()
const authState = {
  session: { access_token: 'test-token' },
  user: { email: 'viewer@example.com' },
  role: 'viewer',
  roleStatus: 'ready',
  roleErrorCode: null,
  passwordFlow: null,
  completePasswordFlow: vi.fn(),
  refreshRole,
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
vi.mock('./components/enrollment/EnrollmentTab', () => ({
  default: ({ students, enrollments, onSelectEnrollment }) => (
    students[0] && enrollments[0]
      ? <button type="button" onClick={() => onSelectEnrollment(students[0], enrollments[0])}>open billing detail</button>
      : null
  ),
}))
vi.mock('./components/enrollment/EnrollmentBillingDetailModal', () => ({
  default: ({ student, enrollment, onClose }) => {
    billingDetailModalSpy({ student, enrollment })
    return <div data-testid="billing-detail-modal">{student.name}:{enrollment.enrollment_id}<button type="button" onClick={onClose}>close billing detail</button></div>
  },
}))
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
vi.mock('./components/courses/CourseManagementTab', () => ({ default: () => <div data-testid="course-management-tab" /> }))
vi.mock('./components/faq/FaqTab', () => ({ default: () => <div data-testid="faq-tab" /> }))
vi.mock('./lib/excelExport', () => ({ exportToExcel: vi.fn() }))
vi.mock('./components/sync/ExportOptionsDialog', () => ({ default: ({ onExport }) => <div data-testid="export-modal" onClick={() => onExport({ exportScope: 'all', selectedSeason: null, options: {} })} /> }))

describe('App header access controls', () => {
  afterEach(cleanup)

  beforeEach(() => {
    authState.session = { access_token: 'test-token' }
    authState.user = { email: 'viewer@example.com' }
    authState.role = 'viewer'
    authState.roleStatus = 'ready'
    authState.roleErrorCode = null
    authState.passwordFlow = null
    signOut.mockClear()
    refreshRole.mockClear()
    apiDataSpy.mockClear()
    studentDetailModalSpy.mockClear()
    billingDetailModalSpy.mockClear()
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
    expect(document.querySelector('.btn-refresh-inline')).toBeNull()
  })

  it.each(['editor', 'admin', 'owner'])('%s can see Excel sync and refresh controls', (role) => {
    authState.role = role
    render(<App />)

    expect(screen.queryAllByTestId('excel-sync')).toHaveLength(1)
    expect(document.querySelector('.btn-refresh-inline')).toBeTruthy()
  })

  it.each([
    ['viewer', false, false, false, false],
    ['editor', true, false, false, false],
    ['admin', true, true, true, true],
    ['owner', true, true, true, true],
  ])('applies ready %s navigation capabilities', (role, manual, users, courses, faq) => {
    authState.role = role
    render(<App />)

    expect(Boolean(document.querySelector('#tab-manual'))).toBe(manual)
    expect(Boolean(document.querySelector('#tab-admin'))).toBe(users)
    expect(Boolean(document.querySelector('#tab-courses'))).toBe(courses)
    expect(Boolean(document.querySelector('#tab-question'))).toBe(faq)
  })

  it('shows the user manual navigation only to editors, admins and owners', () => {
    const { rerender } = render(<App />)

    expect(document.querySelector('#tab-manual')).toBeNull()

    authState.role = 'editor'
    rerender(<App />)
    expect(document.querySelector('#tab-manual')).toBeTruthy()

    authState.role = 'admin'
    rerender(<App />)
    expect(document.querySelector('#tab-manual')).toBeTruthy()

    authState.role = 'owner'
    rerender(<App />)
    expect(document.querySelector('#tab-manual')).toBeTruthy()
  })

  it.each(['admin', 'owner'])('places the user manual immediately before troubleshooting for %s', (role) => {
    authState.role = role
    render(<App />)

    const manualTab = document.querySelector('#tab-manual')
    const troubleshootingTab = document.querySelector('#tab-question')
    expect(manualTab?.nextElementSibling).toBe(troubleshootingTab)
  })

  it.each([
    ['tab-courses', 'course-management-tab'],
    ['tab-admin', 'admin-account-page'],
    ['tab-question', 'faq-tab'],
  ])('lets owner enter the capability-backed %s body', (tabId, bodyTestId) => {
    authState.role = 'owner'
    render(<App />)

    fireEvent.click(document.querySelector(`#${tabId}`))

    expect(screen.getByTestId(bodyTestId)).toBeTruthy()
  })

  it('leaves the user manual immediately after role downgrade', () => {
    authState.role = 'editor'
    const { rerender } = render(<App />)

    fireEvent.click(document.querySelector('#tab-manual'))
    expect(document.querySelector('#tab-manual')?.classList.contains('active')).toBe(true)
    expect(document.querySelector('#tab-manual')?.getAttribute('aria-current')).toBe('page')

    authState.role = 'viewer'
    rerender(<App />)

    expect(document.querySelector('#tab-manual')).toBeNull()
    expect(document.querySelector('#tab-overview')?.classList.contains('active')).toBe(true)
  })

  it('leaves course management immediately after role downgrade', () => {
    authState.role = 'admin'
    const { rerender } = render(<App />)

    fireEvent.click(document.querySelector('#tab-courses'))
    expect(screen.getByTestId('course-management-tab')).toBeTruthy()

    authState.role = 'viewer'
    rerender(<App />)

    expect(screen.queryByTestId('course-management-tab')).toBeNull()
    expect(document.querySelector('#tab-overview')?.classList.contains('active')).toBe(true)
  })

  it('leaves account management immediately after role downgrade', () => {
    authState.role = 'owner'
    const { rerender } = render(<App />)

    fireEvent.click(document.querySelector('#tab-admin'))
    expect(screen.getByTestId('admin-account-page')).toBeTruthy()

    authState.role = 'editor'
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

  it('shows the owner label and color in the header', () => {
    authState.role = 'owner'
    render(<App />)

    const badge = document.querySelector('.header-role-badge')
    expect(badge?.textContent).toBe('最高管理員')
    expect(badge?.style.backgroundColor).toBe('rgb(124, 58, 237)')
  })

  it.each([
    ['loading', null],
    ['unassigned', 'ROLE_NOT_ASSIGNED'],
    ['error', 'ROLE_STORE_ERROR'],
  ])('blocks dashboard data while the stored role is %s', (roleStatus, roleErrorCode) => {
    authState.role = null
    authState.roleStatus = roleStatus
    authState.roleErrorCode = roleErrorCode

    render(<App />)

    expect(screen.getByTestId('role-access-state')).toBeTruthy()
    expect(apiDataSpy).not.toHaveBeenCalled()
    expect(document.querySelector('.app-container')).toBeNull()
  })

  it('renders password setup before mounting authenticated dashboard data', () => {
    authState.passwordFlow = 'invite'
    authState.roleStatus = 'unassigned'
    authState.roleErrorCode = 'ROLE_NOT_ASSIGNED'

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

  it('opens the exact enrollment billing detail independently from student detail', () => {
    const student = { student_id: '1', name: 'Student One' }
    const enrollment = { enrollment_id: 42, student_id: '1', amount: 1200, invoice_number: 'AB12345678', courses: [] }
    apiData = { dbData: { students: [student], enrollments: [enrollment] }, dbStatus: 'connected', dbError: null }
    render(<App />)

    fireEvent.click(document.querySelector('#tab-history'))
    fireEvent.click(screen.getByRole('button', { name: 'open billing detail' }))

    expect(screen.getByTestId('billing-detail-modal').textContent).toContain('Student One:42')
    expect(screen.queryByTestId('student-detail-modal')).toBeNull()
    expect(billingDetailModalSpy).toHaveBeenLastCalledWith({ student, enrollment })

    fireEvent.click(screen.getByRole('button', { name: 'close billing detail' }))
    expect(screen.queryByTestId('billing-detail-modal')).toBeNull()
  })
})
