import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CourseTagPicker from './CourseTagPicker'
import { fetchCourseCatalog } from '../../services/courseCatalogService'

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../../services/courseCatalogService', () => ({
  fetchCourseCatalog: vi.fn(),
  saveCourseCatalogEntry: vi.fn(),
  deactivateCourseCatalogEntry: vi.fn(),
}))

const catalog = [
  { courseCatalogId: 1, courseName: '肌力訓練', active: true },
  { courseCatalogId: 2, courseName: '北歐健走', active: true },
]

describe('CourseTagPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetchCourseCatalog).mockResolvedValue(catalog)
  })

  afterEach(cleanup)

  it('selects and deselects active course tags without a text course input', async () => {
    const onChange = vi.fn()
    render(
      <CourseTagPicker
        selectedCourseNames={['肌力訓練']}
        lockedCourseNames={[]}
        onChange={onChange}
      />,
    )

    const strength = await screen.findByRole('button', { name: '肌力訓練' })
    const walking = screen.getByRole('button', { name: '北歐健走' })
    fireEvent.click(walking)
    expect(onChange).toHaveBeenLastCalledWith(['肌力訓練', '北歐健走'])
    fireEvent.click(strength)
    expect(onChange).toHaveBeenLastCalledWith([])
    expect(screen.queryByRole('textbox', { name: /課程/ })).toBeNull()
  })

  it('keeps selected inactive and historical courses visible while hiding inactive unselected courses', async () => {
    vi.mocked(fetchCourseCatalog).mockResolvedValue([
      ...catalog,
      { courseCatalogId: 3, courseName: '懷舊瑜伽', active: false },
      { courseCatalogId: 4, courseName: '未選停課', active: false },
    ])
    render(
      <CourseTagPicker
        selectedCourseNames={['懷舊瑜伽', '舊制課程']}
        lockedCourseNames={[]}
        onChange={vi.fn()}
      />,
    )

    expect((await screen.findByRole('button', { name: /懷舊瑜伽/ })).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /舊制課程/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.queryByRole('button', { name: '未選停課' })).toBeNull()
  })

  it('prevents a locked selected course from being deselected', async () => {
    const onChange = vi.fn()
    render(
      <CourseTagPicker
        selectedCourseNames={['肌力訓練']}
        lockedCourseNames={['肌力訓練']}
        onChange={onChange}
      />,
    )

    const locked = await screen.findByRole('button', { name: /肌力訓練/ })
    expect(locked.disabled).toBe(true)
    fireEvent.click(locked)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('shows a retryable load error without a free-text fallback', async () => {
    vi.mocked(fetchCourseCatalog)
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce(catalog)
    render(<CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />)

    await screen.findByText('課程名單載入失敗')
    fireEvent.click(screen.getByRole('button', { name: '重試' }))
    expect(await screen.findByRole('button', { name: '肌力訓練' })).toBeTruthy()
  })

  it('does not interpret an unknown management prop as picker authorization', async () => {
    const onChange = vi.fn()
    render(
      <CourseTagPicker
        selectedCourseNames={[]}
        lockedCourseNames={[]}
        onChange={onChange}
        canManage
      />,
    )

    const course = await screen.findByRole('button', { name: '肌力訓練' })
    expect(screen.queryByRole('button', { name: '管理課程' })).toBeNull()
    fireEvent.click(course)
    expect(onChange).toHaveBeenCalledWith(['肌力訓練'])
  })

  it('does not submit its containing enrollment form when selecting a course', async () => {
    const submitEnrollment = vi.fn(event => event.preventDefault())
    render(
      <form onSubmit={submitEnrollment}>
        <CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />
      </form>,
    )

    fireEvent.click(await screen.findByRole('button', { name: '肌力訓練' }))

    expect(submitEnrollment).not.toHaveBeenCalled()
  })
})
