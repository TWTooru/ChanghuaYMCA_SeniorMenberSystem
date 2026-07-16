export { seasonNumber as extractSeasonNum } from './season'

export function cleanStr(value) {
  if (value === undefined || value === null) return null
  const cleaned = String(value).trim()
  return cleaned || null
}

export function cleanInt(value) {
  if (value === undefined || value === null || value === '') return null
  const num = parseInt(value, 10)
  return Number.isNaN(num) ? null : num
}

export function cleanDate(value) {
  if (!value) return null

  const serial = typeof value === 'number'
    ? value
    : /^\d+(\.\d+)?$/.test(String(value).trim()) ? Number(value) : null
  if (serial !== null && serial > 1000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000))
    const yyyy = date.getUTCFullYear()
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  const cleaned = String(value).trim().replace(' 00:00:00', '')
  if (cleaned === '？') return null
  if (cleaned.length >= 10 && cleaned[4] === '-' && cleaned[7] === '-') {
    return cleaned.substring(0, 10)
  }
  const slashDate = cleaned.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (slashDate) {
    const [, yyyy, mm, dd] = slashDate
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  return cleaned || null
}

export function cleanScore(value) {
  if (value === undefined || value === null || value === '') return null

  const cleaned = String(value).trim().replace(' 00:00:00', '')
  if (!cleaned) return null

  if (/^\d+(\.\d+)?$/.test(cleaned)) {
    return String(parseInt(cleaned, 10))
  }

  if (cleaned.length >= 10 && cleaned[4] === '-' && cleaned[7] === '-') {
    return cleaned.substring(0, 10).replace(/-/g, '/')
  }

  return cleaned
}

export function cleanCourseName(value) {
  if (!value) return null
  const cleaned = String(value).trim()
  if (!cleaned || cleaned.includes('Unnamed')) return null
  if (cleaned.includes('00:00:00') || /^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}/.test(cleaned)) {
    return null
  }
  return cleaned
}

export const EXCEL_IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxSheets: 25,
  maxRowsPerSheet: 10000
}

export function validateWorkbookForImport({ fileSize, workbook, getRows }, limits = EXCEL_IMPORT_LIMITS) {
  if (fileSize > limits.maxFileBytes) {
    throw new Error(`Excel file is too large. Maximum size is ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB.`)
  }

  const sheetNames = workbook?.SheetNames || []
  if (sheetNames.length > limits.maxSheets) {
    throw new Error(`Excel workbook has too many sheets. Maximum sheet count is ${limits.maxSheets}.`)
  }

  if (getRows) {
    for (const sheetName of sheetNames) {
      const rows = getRows(workbook.Sheets[sheetName])
      if (rows.length > limits.maxRowsPerSheet) {
        throw new Error(`Excel sheet has too many rows. Maximum row count per sheet is ${limits.maxRowsPerSheet}.`)
      }
    }
  }
}
