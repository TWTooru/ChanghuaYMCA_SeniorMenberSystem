import * as XLSX from 'xlsx'
import { parseTabularRows } from '../domain/seasonImport'
import { validateWorkbookForImport } from '../domain/excelImport'
import { supabase } from '../lib/supabaseClient'
import { loadImportPreview } from './importPreviewService'

export async function prepareImport(file, client = supabase) {
  validateWorkbookForImport({ fileSize: file.size, workbook: { SheetNames: [], Sheets: {} } })

  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
  validateWorkbookForImport({
    fileSize: file.size,
    workbook,
    getRows: sheet => XLSX.utils.sheet_to_json(sheet, { defval: null })
  })

  if (workbook.SheetNames.length !== 1) throw new Error('匯入檔案必須只有一個工作表')

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true })
  if (rows.length === 0) throw new Error('匯入檔案沒有資料')

  return loadImportPreview(client, parseTabularRows(rows))
}

export async function commitImport(preview, client = supabase) {
  if (preview.hasBlockingErrors) throw new Error('匯入資料仍有錯誤，無法寫入')

  const { data, error } = await client.rpc('import_season_data', { p_payload: preview.payload })
  if (error) throw error

  return data
}
