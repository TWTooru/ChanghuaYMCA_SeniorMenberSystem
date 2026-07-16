import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import ExportOptionsDialog from './ExportOptionsDialog'

describe('ExportOptionsDialog', () => {
  afterEach(cleanup)

  const students = [{ student_id: '1', name: '王小明' }]
  const enrollments = [{ student_id: '1', season: '115-4' }, { student_id: '1', season: '115-3' }]

  it('renders elements and triggers onExport with correct values', () => {
    const onExport = vi.fn()
    render(<ExportOptionsDialog students={students} enrollments={enrollments} onExport={onExport} onCancel={vi.fn()} />)

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
    render(<ExportOptionsDialog students={students} enrollments={enrollments} onExport={onExport} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByLabelText('依特定季度篩選'))
    fireEvent.click(screen.getByLabelText('統計摘要')) // uncheck

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
})
