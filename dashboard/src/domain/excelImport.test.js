import { describe, expect, it } from 'vitest'
import {
  cleanDate,
  cleanStr,
  EXCEL_IMPORT_LIMITS,
  validateWorkbookForImport
} from './excelImport'

describe('excel import helpers', () => {
  it('cleans primitive cell values', () => {
    expect(cleanStr('  王小明  ')).toBe('王小明')
    expect(cleanStr(null)).toBeNull()
  })

  it('converts Excel serial and slash dates to ISO-like dates', () => {
    expect(cleanDate(45292)).toBe('2024-01-01')
    expect(cleanDate('19716')).toBe('1953-12-23')
    expect(cleanDate('？')).toBeNull()
    expect(cleanDate('2024/02/03')).toBe('2024-02-03')
    expect(cleanDate('2024/2/3')).toBe('2024-02-03')
    expect(cleanDate('2024-02-03 00:00:00')).toBe('2024-02-03')
    expect(cleanDate('民國69/7/1')).toBe('1980-07-01')
    expect(cleanDate('2024/02/30')).toBe('2024/02/30')
  })

  it('converts SheetJS Date cells without shifting the local calendar day', () => {
    expect(cleanDate(new Date(1999, 0, 1))).toBe('1999-01-01')
  })
})

describe('validateWorkbookForImport', () => {
  it('rejects files larger than the configured limit', () => {
    expect(() => validateWorkbookForImport({
      fileSize: EXCEL_IMPORT_LIMITS.maxFileBytes + 1,
      workbook: { SheetNames: [], Sheets: {} }
    })).toThrow('Excel file is too large')
  })

  it('rejects workbooks with too many sheets', () => {
    const sheetNames = Array.from({ length: EXCEL_IMPORT_LIMITS.maxSheets + 1 }, (_, index) => `Sheet ${index}`)

    expect(() => validateWorkbookForImport({
      fileSize: 100,
      workbook: { SheetNames: sheetNames, Sheets: {} }
    })).toThrow('Excel workbook has too many sheets')
  })

  it('rejects sheets with too many rows', () => {
    const rows = Array.from({ length: EXCEL_IMPORT_LIMITS.maxRowsPerSheet + 1 }, () => ({}))

    expect(() => validateWorkbookForImport({
      fileSize: 100,
      workbook: {
        SheetNames: ['Sheet 1'],
        Sheets: { 'Sheet 1': rows }
      },
      getRows: (_sheet) => rows
    })).toThrow('Excel sheet has too many rows')
  })
})
