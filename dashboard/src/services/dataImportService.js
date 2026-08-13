import * as XLSX from 'xlsx'
import { EXCEL_IMPORT_LIMITS, validateWorkbookForImport } from '../domain/excelImport'
import { MEMBER_IMPORT_HEADERS, normalizeMemberHeader, parseMemberRows } from '../domain/memberImport'
import { supabase } from '../lib/supabaseClient'
import { loadMemberImportPreview } from './importPreviewService'

const acceptedExtensions = ['csv', 'xlsx', 'xls']
const hasMemberHeaders = headers => MEMBER_IMPORT_HEADERS.every(header => headers.includes(header))
const normalizedHeaders = matrix => (matrix[0] || []).map(normalizeMemberHeader)

export function mapImportError(error) {
  const message = error?.message || String(error || '')
  const match = message.match(/ROW_(\d+):([A-Z_]+)/)
  if (match) return new Error(`第 ${match[1]} 列：${match[2]}`)
  return error instanceof Error ? error : new Error(message)
}

async function readWorkbook(file) {
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (!acceptedExtensions.includes(extension)) throw new Error('只接受 CSV、XLSX 或 XLS 檔案')
  if (file.size > EXCEL_IMPORT_LIMITS.maxFileBytes) throw new Error('匯入檔案不可超過 5 MiB')
  const buffer = await file.arrayBuffer()
  if (extension === 'csv') {
    let text
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '')
    } catch {
      throw new Error('CSV 必須使用 UTF-8 編碼')
    }
    return XLSX.read(text, { type: 'string', raw: true })
  }
  return XLSX.read(buffer, { type: 'array', cellDates: true })
}

export async function prepareImport(file, client = supabase) {
  const workbook = await readWorkbook(file)
  validateWorkbookForImport({
    fileSize: file.size,
    workbook,
    getRows: sheet => XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false }),
  })
  const matches = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false })
    return { name, sheet, headers: normalizedHeaders(matrix) }
  }).filter(candidate => hasMemberHeaders(candidate.headers))
  if (matches.length !== 1) throw new Error(matches.length ? 'Excel 有多個符合會員表頭的工作表' : '找不到包含完整會員表頭的工作表')
  const { sheet, headers } = matches[0]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, blankrows: false })
  if (!rows.length) throw new Error('匯入檔案沒有資料')
  return loadMemberImportPreview(client, parseMemberRows(rows, { headers }))
}

export async function commitImport(preview, client = supabase) {
  if (preview.hasBlockingErrors) throw new Error('匯入資料仍有錯誤，無法寫入')
  const { data, error } = await client.rpc('import_student_profiles', { p_rows: preview.payload.rows })
  if (error) throw mapImportError(error)
  return {
    studentsInserted: Number(data?.students_inserted || 0),
    studentsUpdated: Number(data?.students_updated || 0),
    assignedIds: (data?.assigned_ids || []).map(item => ({ sourceRow: Number(item.source_row), studentId: Number(item.student_id) })),
  }
}
