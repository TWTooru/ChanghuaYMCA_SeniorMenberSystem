import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImportPreviewDialog from './ImportPreviewDialog'

const summary = {
  fileRows: 2,
  oldStudents: 1,
  newStudents: 1,
  enrollmentsToInsert: 1,
  enrollmentsToUpdate: 1,
  courses: 2,
  currentStudents: 8,
  currentEnrollments: 9,
  currentCourses: 10,
}

describe('ImportPreviewDialog', () => {
  afterEach(cleanup)

  it('shows a summary and confirms a valid import', () => {
    const onConfirm = vi.fn()

    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('新生 1 人')).not.toBeNull()
    expect(screen.getByText('檔案資料 2 列')).not.toBeNull()
    expect(screen.getByText('既有學生 1 人')).not.toBeNull()
    expect(screen.getByText('新增報名 1 筆')).not.toBeNull()
    expect(screen.getByText('更新報名 1 筆')).not.toBeNull()
    expect(screen.getByText('課程 2 筆')).not.toBeNull()
    expect(screen.getByText('目前學員 8 人')).not.toBeNull()
    expect(screen.getByText('目前報名 9 筆')).not.toBeNull()
    expect(screen.getByText('目前課程 10 筆')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認匯入' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('disables confirmation and shows row errors when blocked', () => {
    render(
      <ImportPreviewDialog
        preview={{
          summary,
          warnings: [],
          errors: [{ row: 2, field: '姓名', message: '姓名必填' }],
          hasBlockingErrors: true,
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByRole('button', { name: '確認匯入' }).disabled).toBe(true)
    expect(screen.getByText(/第 2 列/)).not.toBeNull()
  })

  it('renders warnings and disables confirmation while importing', () => {
    render(
      <ImportPreviewDialog
        preview={{
          summary,
          warnings: [{ row: null, field: '資料庫', message: '請確認新增與更新筆數' }],
          errors: [],
          hasBlockingErrors: false,
        }}
        isImporting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/資料庫.*請確認新增與更新筆數/)).not.toBeNull()
    expect(screen.getByRole('button', { name: '確認匯入' }).disabled).toBe(true)
  })
})
