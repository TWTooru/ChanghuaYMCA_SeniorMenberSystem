import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'
import ExcelSync from './ExcelSync'
import { commitImport, prepareImport } from '../../services/dataImportService'

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }))
vi.mock('sweetalert2-react-content', () => ({ default: swal => swal }))
vi.mock('../../services/dataImportService', () => ({
  prepareImport: vi.fn(),
  commitImport: vi.fn(),
}))

describe('ExcelSync', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(cleanup)

  it('shows an error and re-enables the button when reading fails', async () => {
    prepareImport.mockRejectedValueOnce(new Error('讀取失敗'))
    render(<ExcelSync />)
    const file = new File(['data'], 'invalid.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())
    expect(prepareImport).toHaveBeenCalledWith(file)
    expect(screen.getByRole('button').disabled).toBe(false)
  })

  it('opens a preview and commits only after confirmation', async () => {
    const preview = {
      summary: { fileRows: 1, oldStudents: 0, newStudents: 1, enrollmentsToInsert: 1, enrollmentsToUpdate: 0, courses: 1, currentStudents: 0, currentEnrollments: 0, currentCourses: 0 },
      warnings: [], errors: [], hasBlockingErrors: false,
    }
    const onSyncComplete = vi.fn()
    prepareImport.mockResolvedValueOnce(preview)
    commitImport.mockResolvedValueOnce({ students_inserted: 1, enrollments_updated: 0 })
    render(<ExcelSync onSyncComplete={onSyncComplete} />)
    const file = new File(['data'], 'season.csv', { type: 'text/csv' })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })

    expect(await screen.findByRole('dialog', { name: '匯入預覽' })).not.toBeNull()
    expect(commitImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '確認匯入' }))

    await waitFor(() => expect(commitImport).toHaveBeenCalledWith(preview))
    await waitFor(() => expect(onSyncComplete).toHaveBeenCalledOnce())
  })
})
