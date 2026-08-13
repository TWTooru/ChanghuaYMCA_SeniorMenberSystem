import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDashboardData } from '../services/dashboardDataService'
import useApiData from './useApiData'

vi.mock('../services/dashboardDataService', () => ({
  fetchDashboardData: vi.fn()
}))

const testSession = { user: { id: 'user-1' } }

function ApiDataProbe({ refreshCount = 0 }) {
  const { dbData, dbStatus, dbError } = useApiData(testSession, refreshCount)

  return (
    <div>
      <span data-testid="status">{dbStatus}</span>
      <span data-testid="student-count">{dbData?.students?.length ?? -1}</span>
      <span data-testid="enrollment-count">{dbData?.enrollments?.length ?? -1}</span>
      <span data-testid="error">{dbError || ''}</span>
    </div>
  )
}

function deferred() {
  let resolve
  const promise = new Promise(nextResolve => {
    resolve = nextResolve
  })
  return { promise, resolve }
}

describe('useApiData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(cleanup)

  it('does not load bundled static personal data when Supabase is unavailable', async () => {
    fetchDashboardData.mockRejectedValueOnce(new Error('network offline'))

    render(<ApiDataProbe />)

    await waitFor(() => expect(screen.getByTestId('student-count').textContent).toBe('0'))
    expect(screen.getByTestId('status').textContent).toBe('offline')
    expect(screen.getByTestId('student-count').textContent).toBe('0')
    expect(screen.getByTestId('enrollment-count').textContent).toBe('0')
    expect(screen.getByTestId('error').textContent).toContain('network offline')
  })

  it('keeps the newest dashboard snapshot when an earlier refresh finishes last', async () => {
    const earlierRequest = deferred()
    const refreshedRequest = deferred()
    fetchDashboardData
      .mockImplementationOnce(() => earlierRequest.promise)
      .mockImplementationOnce(() => refreshedRequest.promise)

    const { rerender } = render(<ApiDataProbe refreshCount={0} />)
    await waitFor(() => expect(fetchDashboardData).toHaveBeenCalledTimes(1))

    rerender(<ApiDataProbe refreshCount={1} />)
    await waitFor(() => expect(fetchDashboardData).toHaveBeenCalledTimes(2))

    await act(async () => {
      refreshedRequest.resolve({ students: [{ student_id: '1' }], enrollments: [{ enrollment_id: 'new' }] })
      await refreshedRequest.promise
    })
    expect(screen.getByTestId('enrollment-count').textContent).toBe('1')

    await act(async () => {
      earlierRequest.resolve({ students: [{ student_id: '1' }], enrollments: [] })
      await earlierRequest.promise
    })
    expect(screen.getByTestId('enrollment-count').textContent).toBe('1')
  })
})
