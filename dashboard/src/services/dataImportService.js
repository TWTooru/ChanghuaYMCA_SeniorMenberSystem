import * as XLSX from 'xlsx'
import { parseQuarterCsvRows } from '../domain/quarterCsvImport'
import { supabase } from '../lib/supabaseClient'
import { loadImportPreview } from './importPreviewService'

export function mapImportError(error) {
  const message = error?.message || String(error || '')
  let match = message.match(/ROW_(\d+):INVALID_STUDENT_ID/)
  if (match) return new Error(`第 ${match[1]} 列：學員 ID 必須是大於 0 的整數`)
  match = message.match(/ROW_(\d+):AMBIGUOUS_STUDENT_MATCH/)
  if (match) return new Error(`第 ${match[1]} 列：姓名、性別與出生日期對應多位學生，請先處理資料`)
  match = message.match(/ROW_(\d+):DUPLICATE_IMPORT_IDENTITY:(\d+)/)
  if (match) return new Error(`第 ${match[1]} 列：與來源第 ${match[2]} 列為重複學生`)
  return error
}

export async function prepareImport(file, client = supabase) {
  if (!file?.name?.toLowerCase().endsWith('.csv')) throw new Error('只接受 CSV 檔案')
  if (file.size > 5 * 1024 * 1024) throw new Error('CSV 檔案不可超過 5 MiB')

  let csvText
  try {
    csvText = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, '')
  } catch {
    throw new Error('CSV 必須使用 UTF-8 編碼')
  }

  const workbook = XLSX.read(csvText, { type: 'string', raw: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true, blankrows: false })
  const headers = (matrix[0] || []).map(value => String(value ?? '').trim())
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, blankrows: false })
  if (rows.length === 0) throw new Error('CSV 沒有資料')
  if (rows.length > 10000) throw new Error('CSV 資料不可超過 10,000 列')

  return loadImportPreview(client, parseQuarterCsvRows(rows, { headers }))
}

export async function commitImport(preview, client = supabase) {
  if (preview.hasBlockingErrors) throw new Error('匯入資料仍有錯誤，無法寫入')

  const { data, error } = await client.rpc('import_season_data', { p_payload: preview.payload })
  if (error) throw mapImportError(error)

  return data
}
