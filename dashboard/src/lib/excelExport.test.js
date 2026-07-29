import { describe, it, expect, vi } from 'vitest'
import { exportToExcel } from './excelExport'
import * as XLSX from 'xlsx'

vi.mock('xlsx', () => {
  const book_new = vi.fn(() => ({ SheetNames: [] }))
  const book_append_sheet = vi.fn((wb, sheet, name) => {
    if (wb) {
      if (!wb.SheetNames) wb.SheetNames = []
      wb.SheetNames.push(name)
    }
  })
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
    expect(XLSX.writeFile).toHaveBeenCalledOnce()
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
    expect(XLSX.writeFile).toHaveBeenCalledOnce()
  })

  it('supports swapping options into filename slot', () => {
    vi.clearAllMocks()
    exportToExcel([], [], [], {
      includeStats: false,
      includeStudents: true,
      includeEnrollments: false,
      includeCourses: false
    })
    expect(XLSX.utils.book_append_sheet).toHaveBeenCalledOnce()
    expect(XLSX.writeFile).toHaveBeenCalledWith(expect.any(Object), 'export.xlsx')
  })

  it('aborts early and does not call writeFile if no sheets are included', () => {
    vi.clearAllMocks()
    // 讓模擬的 `workbook` 沒有工作表，以驗證空白活頁簿的防護流程。
    const _originalSheetNames = XLSX.utils.book_new().SheetNames
    XLSX.utils.book_new.mockImplementationOnce(() => ({ SheetNames: [] }))
    
    exportToExcel([], [], [], 'export.xlsx', {
      includeStats: false,
      includeStudents: false,
      includeEnrollments: false,
      includeCourses: false
    })
    expect(XLSX.utils.book_append_sheet).not.toHaveBeenCalled()
    expect(XLSX.writeFile).not.toHaveBeenCalled()
  })
})
