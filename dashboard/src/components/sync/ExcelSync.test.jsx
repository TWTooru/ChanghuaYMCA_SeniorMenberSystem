import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Swal from 'sweetalert2'
import ExcelSync from './ExcelSync'
import { runSync } from '../../services/excelSyncService'

vi.mock('sweetalert2', () => ({ default: { fire: vi.fn() } }))
vi.mock('sweetalert2-react-content', () => ({ default: swal => swal }))
vi.mock('../../services/excelSyncService', () => ({ runSync: vi.fn() }))

describe('ExcelSync', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows an error and re-enables the button when syncing fails', async () => {
    runSync.mockRejectedValueOnce(new Error('檔案格式錯誤'))
    render(<ExcelSync />)
    const file = new File(['data'], 'invalid.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())
    expect(runSync).toHaveBeenCalledWith(file)
    expect(screen.getByRole('button').disabled).toBe(false)
  })
})
