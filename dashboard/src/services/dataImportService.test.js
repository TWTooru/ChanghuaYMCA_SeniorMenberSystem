import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { parseQuarterCsvRows } from '../domain/quarterCsvImport'
import { loadImportPreview } from './importPreviewService'
import { commitImport, prepareImport } from './dataImportService'

vi.mock('xlsx', () => ({
  read: vi.fn(),
  utils: { sheet_to_json: vi.fn() }
}))

vi.mock('../domain/quarterCsvImport', () => ({
  parseQuarterCsvRows: vi.fn()
}))

vi.mock('./importPreviewService', () => ({
  loadImportPreview: vi.fn()
}))

describe('data import service', () => {
  it('rejects non-CSV files before reading', async () => {
    const file = { name: 'quarter.xlsx', size: 100, arrayBuffer: vi.fn() }
    const client = { rpc: vi.fn() }

    await expect(prepareImport(file, client)).rejects.toThrow('只接受 CSV 檔案')
    expect(file.arrayBuffer).not.toHaveBeenCalled()
  })

  it('decodes UTF-8 CSV with a BOM and passes the explicit header row to the parser', async () => {
    const file = {
      name: 'quarter.csv',
      size: 100,
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('\uFEFF姓名,第16季前測').buffer)
    }
    const client = { rpc: vi.fn() }
    XLSX.read.mockReturnValue({ SheetNames: ['資料'], Sheets: { 資料: {} } })
    XLSX.utils.sheet_to_json
      .mockReturnValueOnce([['姓名', '第16季前測']])
      .mockReturnValueOnce([{ 姓名: '王小明', 第16季前測: '2026/3/5' }])
    parseQuarterCsvRows.mockReturnValue({ rows: [], warnings: [], errors: [] })
    loadImportPreview.mockResolvedValue({ hasBlockingErrors: false, payload: { mode: 'single-season', rows: [] } })

    await prepareImport(file, client)
    expect(XLSX.read).toHaveBeenCalledWith('姓名,第16季前測', { type: 'string', raw: true })
    expect(parseQuarterCsvRows).toHaveBeenCalledWith(
      [{ 姓名: '王小明', 第16季前測: '2026/3/5' }],
      { headers: ['姓名', '第16季前測'] }
    )
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('reads CSV cells as raw text before parsing', async () => {
    const file = {
      name: 'quarter.csv',
      size: 100,
      arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('name,date\nAda,2026-03-05').buffer)
    }
    const client = { rpc: vi.fn() }
    XLSX.read.mockReturnValue({ SheetNames: ['data'], Sheets: { data: {} } })
    XLSX.utils.sheet_to_json
      .mockReturnValueOnce([['name', 'date']])
      .mockReturnValueOnce([{ name: 'Ada', date: '2026-03-05' }])
    parseQuarterCsvRows.mockReturnValue({ rows: [], warnings: [], errors: [] })
    loadImportPreview.mockResolvedValue({ hasBlockingErrors: false, payload: { mode: 'single-season', rows: [] } })

    await prepareImport(file, client)

    expect(XLSX.read).toHaveBeenLastCalledWith(expect.any(String), { type: 'string', raw: true })
  })

  it('rejects malformed UTF-8', async () => {
    const file = {
      name: 'quarter.csv',
      size: 2,
      arrayBuffer: vi.fn().mockResolvedValue(Uint8Array.from([0xff, 0xff]).buffer)
    }

    await expect(prepareImport(file)).rejects.toThrow('CSV 必須使用 UTF-8 編碼')
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
