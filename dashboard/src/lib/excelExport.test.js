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

  it('exports only final member profile and period enrollment columns', () => {
    vi.clearAllMocks()
    exportToExcel(
      [{ student_id: 7, email: 'member@example.com', name: '王小明', gender: '男', phone: '0912', birth_date: '1980-01-01', address: '台北市', organization: '市民大學', education: '高中' }],
      [{ enrollment_id: 9, student_id: 7, student_name: '王小明', period: '第16期', reg_type: '新', courses: ['瑜珈'], refunded: false, prepaid_amount: 500, prepaid_receipt_number: 'P001', tuition_fee: 1000, materials_fee: 200, membership_fee: 100, fee_receipt_number: 'F001', handled_by_name: '陳小美', handled_on: '2026-08-01', notes: '備註', amount: 1200, invoice_number: 'A001' }],
      [], 'members.xlsx', { includeStats: false, includeCourses: false },
    )
    expect(XLSX.utils.json_to_sheet).toHaveBeenNthCalledWith(1, [expect.objectContaining({
      ID: 7, 電子郵件地址: 'member@example.com', 姓名: '王小明', 性別: '男', 電話: '0912', 出生年月日: '1980-01-01', 通訊處: '台北市', '服務機關 / 學校': '市民大學', 教育程度: '高中',
    })])
    expect(XLSX.utils.json_to_sheet).toHaveBeenNthCalledWith(2, [expect.objectContaining({
      ID: 9, 會員ID: 7, 姓名: '王小明', 期別: '第16期', 報名課程: '瑜珈', 是否退費: '否',
      預繳金額: 500, 預繳收據號碼: 'P001', 學費: 1000, 材料費: 200, 會費: 100, 費用收據號碼: 'F001',
      經辦人: '陳小美', 經辦日期: '2026-08-01', 備註: '備註',
      '金額（舊版）': 1200, '發票編號（舊版）': 'A001',
    })])
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
