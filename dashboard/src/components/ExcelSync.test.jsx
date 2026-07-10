import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import Swal from 'sweetalert2'
import ExcelSync from './ExcelSync'
import { EXCEL_IMPORT_LIMITS } from '../domain/excelImport'

vi.mock('xlsx', () => ({
  read: vi.fn(() => ({ SheetNames: [], Sheets: {} })),
  utils: {
    sheet_to_json: vi.fn(() => [])
  }
}))

vi.mock('sweetalert2', () => ({
  default: {
    fire: vi.fn()
  }
}))

vi.mock('sweetalert2-react-content', () => ({
  default: (swal) => swal
}))

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({
        data: { session: { user: { id: 'user-1' } } },
        error: null
      }))
    }
  }
}))

describe('ExcelSync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects oversized files before parsing them with xlsx', async () => {
    render(<ExcelSync />)

    const file = new File(['small'], 'large.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
    Object.defineProperty(file, 'size', {
      value: EXCEL_IMPORT_LIMITS.maxFileBytes + 1
    })

    fireEvent.change(document.querySelector('input[type="file"]'), {
      target: { files: [file] }
    })

    await waitFor(() => expect(Swal.fire).toHaveBeenCalled())

    expect(XLSX.read).not.toHaveBeenCalled()
    expect(screen.getByRole('button').disabled).toBe(false)
  })
})
