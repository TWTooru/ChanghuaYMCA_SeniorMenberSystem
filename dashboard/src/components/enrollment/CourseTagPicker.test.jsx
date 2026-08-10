import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CourseTagPicker from './CourseTagPicker'
import {
  deactivateCourseCatalogEntry,
  fetchCourseCatalog,
  saveCourseCatalogEntry,
} from '../../services/courseCatalogService'

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
    render(<CourseTagPicker selectedCourseNames={['肌力訓練']} lockedCourseNames={[]} onChange={onChange} />)

    const strength = await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '北歐健走' }))
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

  it('preserves catalog management without a picker-level authorization prop', async () => {
    render(
      <CourseTagPicker
        selectedCourseNames={[]}
        lockedCourseNames={[]}
        onChange={vi.fn()}
      />,
    )

    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    await screen.findByRole('dialog', { name: '管理課程' })
    expect(document.activeElement).toBe(screen.getByRole('button', { name: '關閉' }))
  })

  it('disables course selection and management controls when requested', async () => {
    const onChange = vi.fn()
    render(
      <CourseTagPicker
        selectedCourseNames={[]}
        lockedCourseNames={[]}
        onChange={onChange}
        disabled
      />,
    )

    const course = await screen.findByRole('button', { name: '肌力訓練' })
    expect(course.disabled).toBe(true)
    expect(screen.getByRole('button', { name: '管理課程' }).disabled).toBe(true)
    fireEvent.click(course)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('wraps keyboard focus inside the catalog manager and restores its opener', async () => {
    render(<CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />)
    await screen.findByRole('button', { name: '肌力訓練' })
    const manageButton = screen.getByRole('button', { name: '管理課程' })
    fireEvent.click(manageButton)

    const close = await screen.findByRole('button', { name: '關閉' })
    const last = screen.getByRole('button', { name: '停用 北歐健走' })
    fireEvent.keyDown(close, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(last, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.click(close)
    await waitFor(() => expect(document.activeElement).toBe(manageButton))
  })

  it('adds or reactivates a course, refreshes the catalog, and preserves selections', async () => {
    const onChange = vi.fn()
    vi.mocked(saveCourseCatalogEntry).mockResolvedValue({
      courseCatalogId: 3,
      courseName: '伸展課',
      active: true,
    })
    vi.mocked(fetchCourseCatalog)
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce([...catalog, { courseCatalogId: 3, courseName: '伸展課', active: true }])
    render(
      <CourseTagPicker
        selectedCourseNames={['肌力訓練']}
        lockedCourseNames={[]}
        onChange={onChange}
      />,
    )

    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    fireEvent.change(screen.getByLabelText('新增課程名稱'), { target: { value: '  伸展課  ' } })
    fireEvent.click(screen.getByRole('button', { name: '新增或重新啟用' }))

    expect(await screen.findByRole('button', { name: '伸展課' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '肌力訓練' }).getAttribute('aria-pressed')).toBe('true')
    expect(onChange).not.toHaveBeenCalled()
    expect(saveCourseCatalogEntry).toHaveBeenCalledWith(expect.anything(), '  伸展課  ')
  })

  it('does not submit its containing enrollment form when adding a course', async () => {
    const submitEnrollment = vi.fn(event => event.preventDefault())
    vi.mocked(saveCourseCatalogEntry).mockResolvedValue({
      courseCatalogId: 3,
      courseName: '伸展課',
      active: true,
    })
    vi.mocked(fetchCourseCatalog)
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce([...catalog, { courseCatalogId: 3, courseName: '伸展課', active: true }])
    render(
      <form onSubmit={submitEnrollment}>
        <CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />
      </form>,
    )

    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    fireEvent.change(screen.getByLabelText('新增課程名稱'), { target: { value: '伸展課' } })
    fireEvent.click(screen.getByRole('button', { name: '新增或重新啟用' }))

    expect(await screen.findByRole('button', { name: '伸展課' })).toBeTruthy()
    expect(submitEnrollment).not.toHaveBeenCalled()
  })

  it('preserves Enter-key submission in the catalog manager', async () => {
    vi.mocked(saveCourseCatalogEntry).mockResolvedValue({
      courseCatalogId: 3,
      courseName: '伸展課',
      active: true,
    })
    vi.mocked(fetchCourseCatalog)
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce([...catalog, { courseCatalogId: 3, courseName: '伸展課', active: true }])
    render(<CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />)

    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    const input = screen.getByLabelText('新增課程名稱')
    fireEvent.change(input, { target: { value: '伸展課' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(await screen.findByRole('button', { name: '伸展課' })).toBeTruthy()
    expect(saveCourseCatalogEntry).toHaveBeenCalledWith(expect.anything(), '伸展課')
  })

  it('does not submit while Enter confirms a Chinese IME candidate', async () => {
    render(<CourseTagPicker selectedCourseNames={[]} lockedCourseNames={[]} onChange={vi.fn()} />)
    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    const input = screen.getByLabelText('新增課程名稱')
    fireEvent.change(input, { target: { value: '伸展' } })

    fireEvent.keyDown(input, { key: 'Enter', isComposing: true })

    expect(saveCourseCatalogEntry).not.toHaveBeenCalled()
    expect(input.value).toBe('伸展')
  })

  it('confirms deactivation, refreshes the catalog, and retains a selected historical tag', async () => {
    vi.mocked(deactivateCourseCatalogEntry).mockResolvedValue(undefined)
    vi.mocked(fetchCourseCatalog)
      .mockResolvedValueOnce(catalog)
      .mockResolvedValueOnce([
        { courseCatalogId: 1, courseName: '肌力訓練', active: false },
        catalog[1],
      ])
    render(
      <CourseTagPicker
        selectedCourseNames={['肌力訓練']}
        lockedCourseNames={[]}
        onChange={vi.fn()}
      />,
    )

    await screen.findByRole('button', { name: '肌力訓練' })
    fireEvent.click(screen.getByRole('button', { name: '管理課程' }))
    fireEvent.click(screen.getByRole('button', { name: '停用 肌力訓練' }))
    expect(screen.getByText('停用「肌力訓練」不會刪除既有歷史資料。')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '確認停用' }))

    await waitFor(() => expect(deactivateCourseCatalogEntry).toHaveBeenCalledWith(expect.anything(), 1))
    expect(await screen.findByRole('button', { name: /肌力訓練/ })).toBeTruthy()
  })
})
