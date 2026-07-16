import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { parseTabularRows } from '../domain/seasonImport'
import { loadImportPreview } from './importPreviewService'
import { commitImport, prepareImport } from './dataImportService'

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() }
}))

vi.mock('../domain/seasonImport', () => ({
  parseTabularRows: vi.fn()
}))

vi.mock('./importPreviewService', () => ({
  loadImportPreview: vi.fn()
}))

describe('data import service', () => {
  it('reads CSV/Excel and returns a preview without writing', async () => {
    const file = { size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)) }
    const client = { rpc: vi.fn() }
    XLSX.read.mockReturnValue({ SheetNames: ['資料'], Sheets: { 資料: {} } })
    XLSX.utils.sheet_to_json.mockReturnValue([{ 姓名: '王小明', 第16季前測: '80' }])
    parseTabularRows.mockReturnValue({ rows: [], warnings: [], errors: [] })
    loadImportPreview.mockResolvedValue({ hasBlockingErrors: false, payload: { mode: 'single-season', rows: [] } })

    await expect(prepareImport(file, client)).resolves.toMatchObject({ hasBlockingErrors: false })
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('refuses to commit a blocked preview', async () => {
    const client = { rpc: vi.fn() }

    await expect(commitImport({ hasBlockingErrors: true, errors: [{ message: '錯誤' }] }, client)).rejects.toThrow('匯入資料仍有錯誤')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('sends only the normalized payload to the RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { students_inserted: 1 }, error: null }) }
    const payload = { mode: 'single-season', rows: [{ source_row: 2 }] }

    await expect(commitImport({ hasBlockingErrors: false, payload }, client)).resolves.toEqual({ students_inserted: 1 })
    expect(client.rpc).toHaveBeenCalledWith('import_season_data', { p_payload: payload })
  })
})
