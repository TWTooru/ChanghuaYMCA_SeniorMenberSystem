import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import StudentListTab from './StudentListTab'

const authState = { role: 'viewer' }

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => authState,
}))

describe('StudentListTab add-student access', () => {
  afterEach(cleanup)

  it('hides the add-student button from viewers', () => {
    const { container } = render(
      <StudentListTab
        students={[]}
        enrollments={[]}
        onSelectStudent={vi.fn()}
        onShowAddStudent={vi.fn()}
      />
    )

    expect(container.querySelector('#btn-add-student')).toBeNull()
  })
})
