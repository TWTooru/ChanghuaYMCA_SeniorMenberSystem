import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { fetchDashboardData } from '../services/dashboardDataService'
import useApiData from './useApiData'

vi.mock('../services/dashboardDataService', () => ({
  fetchDashboardData: vi.fn()
}))

function ApiDataProbe() {
  const { dbData, dbStatus, dbError } = useApiData({ user: { id: 'user-1' } }, 0)

  return (
    <div>
      <span data-testid="status">{dbStatus}</span>
      <span data-testid="student-count">{dbData?.students?.length ?? -1}</span>
      <span data-testid="enrollment-count">{dbData?.enrollments?.length ?? -1}</span>
      <span data-testid="error">{dbError || ''}</span>
    </div>
  )
}

describe('useApiData', () => {
  it('does not load bundled static personal data when Supabase is unavailable', async () => {
    fetchDashboardData.mockRejectedValueOnce(new Error('network offline'))

    render(<ApiDataProbe />)

    await waitFor(() => expect(screen.getByTestId('student-count').textContent).toBe('0'))
    expect(screen.getByTestId('status').textContent).toBe('offline')
    expect(screen.getByTestId('student-count').textContent).toBe('0')
    expect(screen.getByTestId('enrollment-count').textContent).toBe('0')
    expect(screen.getByTestId('error').textContent).toContain('network offline')
  })
})
