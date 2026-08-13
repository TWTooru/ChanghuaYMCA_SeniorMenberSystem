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

const summary = { fileRows: 2, newStudents: 1, updatedStudents: 1, currentStudents: 8 }

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

  // preview 與 commit 分開 mock，確保讀檔階段不會提前寫入。
  it('opens a preview and commits only after confirmation', async () => {
    const preview = {
      summary: { fileRows: 1, newStudents: 1, updatedStudents: 0, currentStudents: 0 },
      warnings: [], errors: [], hasBlockingErrors: false,
    }
    const onSyncComplete = vi.fn()
    prepareImport.mockResolvedValueOnce(preview)
    commitImport.mockResolvedValueOnce({ studentsInserted: 1, studentsUpdated: 0, assignedIds: [] })
    render(<ExcelSync onSyncComplete={onSyncComplete} />)
    const file = new File(['data'], 'members.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })

    expect(await screen.findByRole('dialog', { name: '匯入會員預覽' })).not.toBeNull()
    expect(commitImport).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '確認匯入' }))

    await waitFor(() => expect(commitImport).toHaveBeenCalledWith(preview))
    await waitFor(() => expect(onSyncComplete).toHaveBeenCalledOnce())
  })

  it('displays the source-row-to-ID mapping returned for newly assigned students', async () => {
    const preview = {
      summary: { fileRows: 1, newStudents: 1, updatedStudents: 0, currentStudents: 0 },
      warnings: [], errors: [], hasBlockingErrors: false,
    }
    prepareImport.mockResolvedValueOnce(preview)
    commitImport.mockResolvedValueOnce({ studentsInserted: 1, studentsUpdated: 0, assignedIds: [{ sourceRow: 2, studentId: 399 }] })
    render(<ExcelSync />)

    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['data'], 'members.xls', { type: 'application/vnd.ms-excel' })] } })
    fireEvent.click(await screen.findByRole('button', { name: '確認匯入' }))

    await waitFor(() => expect(commitImport).toHaveBeenCalledOnce())
    expect(await screen.findByRole('dialog', { name: '本次指派的學員編號' })).not.toBeNull()
    expect(screen.getByText('來源第 2 列：399')).not.toBeNull()
  })
  it('copies newly assigned member IDs and accepts all member import extensions', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue() } })
    prepareImport.mockResolvedValueOnce({ summary, warnings: [], errors: [], hasBlockingErrors: false })
    commitImport.mockResolvedValueOnce({ studentsInserted: 1, studentsUpdated: 0, assignedIds: [{ sourceRow: 2, studentId: 399 }] })
    render(<ExcelSync />)

    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['data'], 'members.csv', { type: 'text/csv' })] } })
    fireEvent.click(await screen.findByRole('button', { name: '確認匯入' }))
    await waitFor(() => expect(commitImport).toHaveBeenCalledOnce())
    fireEvent.click(await screen.findByRole('button', { name: '複製新學員編號' }))

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('來源第 2 列：399')
    expect(document.querySelector('input[type="file"]').accept).toBe('.csv,.xlsx,.xls')
  })
})
