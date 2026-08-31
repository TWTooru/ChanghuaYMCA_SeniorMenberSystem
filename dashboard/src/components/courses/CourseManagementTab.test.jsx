import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { saveCourseCatalogEntry, deactivateCourseCatalogEntry } from '../../services/courseCatalogService'

const { mockCatalog } = vi.hoisted(() => ({
  mockCatalog: [
    { courseCatalogId: 1, courseName: '瑜珈', active: true },
    { courseCatalogId: 2, courseName: '太極拳', active: false },
  ],
}))

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))

vi.mock('../../services/courseCatalogService', () => ({
  fetchCourseCatalog: vi.fn().mockResolvedValue(mockCatalog),
  saveCourseCatalogEntry: vi.fn().mockResolvedValue({ courseCatalogId: 3, courseName: '桌球', active: true }),
  deactivateCourseCatalogEntry: vi.fn().mockResolvedValue(undefined),
}))

import CourseManagementTab from './CourseManagementTab'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('CourseManagementTab', () => {
  it('renders course catalog with active and inactive courses', async () => {
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('瑜珈')).toBeTruthy())
    expect(screen.getByText('太極拳')).toBeTruthy()
    expect(screen.getByText('啟用 1 門 · 停用 1 門')).toBeTruthy()
  })

  it('filters courses by status', async () => {
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('瑜珈')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '已停用' }))
    expect(screen.queryByText('瑜珈')).toBeNull()
    expect(screen.getByText('太極拳')).toBeTruthy()
  })

  it('exposes the selected course-status filter to assistive technology', async () => {
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('瑜珈')).toBeTruthy())

    const inactiveFilter = screen.getByRole('button', { name: '已停用' })
    expect(inactiveFilter.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(inactiveFilter)
    expect(inactiveFilter.getAttribute('aria-pressed')).toBe('true')
  })

  it('allows adding a new course', async () => {
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('瑜珈')).toBeTruthy())

    const input = screen.getByPlaceholderText('輸入課程名稱以新增或重新啟用')
    fireEvent.change(input, { target: { value: '皮拉提斯' } })
    fireEvent.click(screen.getByText('新增 / 重新啟用'))

    await waitFor(() => {
      expect(saveCourseCatalogEntry).toHaveBeenCalledWith(expect.anything(), '皮拉提斯')
    })
  })

  it('allows deactivating an active course after confirmation', async () => {
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('瑜珈')).toBeTruthy())

    const deactivateButtons = screen.getAllByText('停用')
    // Click '停用' button next to 瑜珈 (the table row action button)
    fireEvent.click(deactivateButtons[0])

    expect(screen.getByText('確定要停用「瑜珈」嗎？停用後不會刪除既有歷史資料。')).toBeTruthy()

    fireEvent.click(screen.getByText('確認停用'))

    await waitFor(() => {
      expect(deactivateCourseCatalogEntry).toHaveBeenCalledWith(expect.anything(), 1)
    })
  })

  it('clears stale error on successful reactivation', async () => {
    saveCourseCatalogEntry.mockRejectedValueOnce(new Error('舊的錯誤'))
    render(<CourseManagementTab />)
    await waitFor(() => expect(screen.getByText('太極拳')).toBeTruthy())

    // Trigger an error first
    fireEvent.click(screen.getByText('重新啟用'))
    await waitFor(() => expect(screen.getByText('舊的錯誤')).toBeTruthy())

    // Successful reactivation should clear the error
    saveCourseCatalogEntry.mockResolvedValueOnce({ courseCatalogId: 2, courseName: '太極拳', active: true })
    fireEvent.click(screen.getByText('重新啟用'))
    await waitFor(() => {
      expect(screen.queryByText('舊的錯誤')).toBeNull()
    })
  })
})
