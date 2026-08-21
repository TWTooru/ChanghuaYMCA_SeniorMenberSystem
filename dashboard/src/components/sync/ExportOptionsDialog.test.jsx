import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import ExportOptionsDialog from './ExportOptionsDialog'

describe('ExportOptionsDialog', () => {
  afterEach(cleanup)

  const enrollments = [{ student_id: '1', season: '115-4' }, { student_id: '1', season: '115-3' }]

  it('renders elements and triggers onExport with correct values', () => {
    const onExport = vi.fn()
    render(<ExportOptionsDialog enrollments={enrollments} onExport={onExport} onCancel={vi.fn()} />)

    expect(screen.getByText('Excel 匯出設定')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認下載' }))
    expect(onExport).toHaveBeenCalledWith({
      exportScope: 'all',
      selectedSeason: null,
      options: {
        includeStats: true,
        includeStudents: true,
        includeEnrollments: true,
        includeCourses: true
      }
    })
  })

  it('handles season selection and option toggling', () => {
    const onExport = vi.fn()
    render(<ExportOptionsDialog enrollments={enrollments} onExport={onExport} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('依特定季度篩選'))
    fireEvent.click(screen.getByLabelText('統計摘要'))

    fireEvent.click(screen.getByRole('button', { name: '確認下載' }))
    expect(onExport).toHaveBeenCalledWith({
      exportScope: 'season',
      selectedSeason: '115-4',
      options: {
        includeStats: false,
        includeStudents: true,
        includeEnrollments: true,
        includeCourses: true
      }
    })
  })

  it('does not dismiss when its outer overlay is clicked', () => {
    const onCancel = vi.fn()
    render(<ExportOptionsDialog enrollments={enrollments} onExport={vi.fn()} onCancel={onCancel} />)
    fireEvent.click(document.querySelector('.modal-overlay-center'))
    expect(onCancel).not.toHaveBeenCalled()
  })

  // 以首尾 focusable element 驗證 Tab／Shift+Tab 循環。
  it('traps keyboard focus when Tab key is pressed', () => {
    render(
      <ExportOptionsDialog enrollments={enrollments} onExport={vi.fn()} onCancel={vi.fn()} />
    )

    const inputs = document.body.querySelectorAll('.form-modal-content input, .form-modal-content button')
    const firstInput = inputs[0]
    const lastButton = inputs[inputs.length - 1]

    expect(document.activeElement).toBe(firstInput)

    fireEvent.keyDown(document.querySelector('.form-modal-content'), {
      key: 'Tab',
      shiftKey: true
    })
    expect(document.activeElement).toBe(lastButton)

    fireEvent.keyDown(document.querySelector('.form-modal-content'), {
      key: 'Tab',
      shiftKey: false
    })
    expect(document.activeElement).toBe(firstInput)
  })
})
