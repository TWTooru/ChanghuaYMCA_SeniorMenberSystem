import { describe, it, expect, vi } from 'vitest'
import { exportToExcel } from './excelExport'
import * as XLSX from 'xlsx'

vi.mock('xlsx', () => {
  const book_new = vi.fn(() => ({}))
  const book_append_sheet = vi.fn()
  const writeFile = vi.fn()
  const json_to_sheet = vi.fn(() => ({}))
  return {
    utils: { book_new, book_append_sheet, json_to_sheet },
    writeFile
  }
})

describe('excelExport', () => {
  it('calls book_append_sheet for default options', () => {
    vi.clearAllMocks()
    exportToExcel([], [], [])
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(4)
  })

  it('selectively calls book_append_sheet based on options', () => {
    vi.clearAllMocks()
    exportToExcel([], [], [], 'export.xlsx', {
      includeStats: true,
      includeStudents: false,
      includeEnrollments: true,
      includeCourses: false
    })
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledTimes(2)
  })
})
