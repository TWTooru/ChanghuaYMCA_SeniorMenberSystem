import { describe, expect, it, vi } from 'vitest'
import * as XLSX from 'xlsx'
import { commitImport, prepareImport } from './dataImportService'

vi.mock('xlsx', () => ({ read: vi.fn(), utils: { sheet_to_json: vi.fn() } }))

const headers = ['時間戳記', '電子郵件地址', '姓名', '性別', '電話 / 手機號碼', '出生年月日', '通訊處', '服務機關 / 學校', '教育程度']
const exampleHeaders = ['時間戳記', '電子郵件地址', '姓名', '性別', '電話/手機號碼', '出生年月日', '通訊處', '服務機關/學校', '教育程度']

describe('member import service', () => {
  it('loads a UTF-8 CSV member sheet then previews current students', async () => {
    const file = { name: 'members.csv', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('x').buffer) }
    XLSX.read.mockReturnValue({ SheetNames: ['會員'], Sheets: { 會員: {} } })
    XLSX.utils.sheet_to_json
      .mockReturnValueOnce([headers, ['x']])
      .mockReturnValueOnce([headers, ['x']])
      .mockReturnValueOnce([{ 姓名: '王小明', 性別: '男', 教育程度: '高中' }])
    const client = { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }

    const preview = await prepareImport(file, client)
    expect(XLSX.read).toHaveBeenCalledWith('x', { type: 'string', raw: true })
    expect(preview.summary).toMatchObject({ fileRows: 1, newStudents: 1, currentStudents: 0 })
  })

  it('recognizes the exact Google Form export headers as a member sheet', async () => {
    const file = { name: 'members.xlsx', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)) }
    XLSX.read.mockReturnValue({ SheetNames: ['學員基本資料'], Sheets: { 學員基本資料: {} } })
    XLSX.utils.sheet_to_json
      .mockReturnValueOnce([exampleHeaders, ['x']])
      .mockReturnValueOnce([exampleHeaders, ['x']])
      .mockReturnValueOnce([{
        電子郵件地址: 'test@test.com',
        姓名: '黃彥志',
        性別: '男性',
        '電話/手機號碼': '09099996939',
        出生年月日: new Date(1999, 0, 1),
        通訊處: '彰化市永芳路467巷70弄10號',
        '服務機關/學校': null,
        教育程度: '專科/大學',
      }])
    const client = { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }

    await expect(prepareImport(file, client)).resolves.toMatchObject({
      summary: { fileRows: 1, newStudents: 1 },
      hasBlockingErrors: false,
    })
  })

  it('rejects multiple matching worksheets', async () => {
    const file = { name: 'members.xlsx', size: 100, arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(1)) }
    XLSX.read.mockReturnValue({ SheetNames: ['甲', '乙'], Sheets: { 甲: {}, 乙: {} } })
    XLSX.utils.sheet_to_json.mockReturnValue([headers, ['x']])
    await expect(prepareImport(file, {})).rejects.toThrow('多個符合會員表頭')
  })

  it('commits only the preview row payload to the member profile RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: { students_inserted: 1, students_updated: 2, assigned_ids: [{ source_row: 7, student_id: 33 }] }, error: null }) }
    await expect(commitImport({ hasBlockingErrors: false, payload: { rows: [{ source_row: 7 }] } }, client)).resolves.toEqual({
      studentsInserted: 1, studentsUpdated: 2, assignedIds: [{ sourceRow: 7, studentId: 33 }],
    })
    expect(client.rpc).toHaveBeenCalledWith('import_student_profiles', { p_rows: [{ source_row: 7 }] })
  })
})
