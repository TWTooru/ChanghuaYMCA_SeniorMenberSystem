import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/excelExport', () => ({ exportToExcel: vi.fn() }))

import useExportHandler from './useExportHandler'
import { exportToExcel } from '../lib/excelExport'

describe('useExportHandler', () => {
  it('calls exportToExcel with all data when scope is "all"', () => {
    const students = [{ student_id: '1', name: 'A' }]
    const enrollments = [{ student_id: 1, period: '第15期', refunded: false, courses: ['肌力訓練'] }]

    const { result } = renderHook(() => useExportHandler(students, enrollments))
    result.current({ exportScope: 'all', selectedPeriod: null, options: { summary: true } })

    expect(exportToExcel).toHaveBeenCalledWith(
      students,
      enrollments,
      [{ Course: '肌力訓練', Count: 1 }],
      'YMCA_export_all.xlsx',
      { summary: true }
    )
  })

  it('filters by period when scope is "period"', () => {
    const students = [
      { student_id: '1', name: 'A' },
      { student_id: '2', name: 'B' },
    ]
    const enrollments = [
      { student_id: 1, period: '第15期', refunded: false, courses: ['肌力訓練'] },
      { student_id: 2, period: '第16期', refunded: false, courses: ['北歐健走'] },
    ]

    const { result } = renderHook(() => useExportHandler(students, enrollments))
    result.current({ exportScope: 'period', selectedPeriod: '第15期', options: {} })

    expect(exportToExcel).toHaveBeenCalledWith(
      [students[0]],
      [enrollments[0]],
      [{ Course: '肌力訓練', Count: 1 }],
      'YMCA_export_第15期.xlsx',
      {}
    )
  })
})
