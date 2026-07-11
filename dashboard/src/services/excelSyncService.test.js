import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { runSync } from './excelSyncService'
import { EXCEL_IMPORT_LIMITS } from '../domain/excelImport'

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() }
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

describe('runSync', () => {
  it('rejects oversized files before parsing them with xlsx', async () => {
    const file = {
      size: EXCEL_IMPORT_LIMITS.maxFileBytes + 1,
      arrayBuffer: vi.fn()
    }

    await expect(runSync(file)).rejects.toThrow('Excel file is too large')
    expect(XLSX.read).not.toHaveBeenCalled()
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })
})
