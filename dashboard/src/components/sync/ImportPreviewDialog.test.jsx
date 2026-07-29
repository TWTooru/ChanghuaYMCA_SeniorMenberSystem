import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImportPreviewDialog from './ImportPreviewDialog'

const summary = {
  targetSeason: '第十六季',
  fileRows: 2,
  oldStudents: 1,
  newStudents: 1,
  enrollmentsToInsert: 1,
  enrollmentsToUpdate: 1,
  courses: 2,
  preTestsCleared: 1,
  postTestsCleared: 2,
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

    expect(screen.getByText('新增報名 1 筆')).not.toBeNull()
    expect(screen.getByText('更新報名 1 筆')).not.toBeNull()
    expect(screen.getByText('課程 2 筆')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認匯入' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows blank-ID student reconciliation results', () => {
    render(
      <ImportPreviewDialog
        preview={{
          summary,
          studentResolutions: [
            { sourceRow: 2, studentName: 'Ada', action: 'update', studentId: '12' },
            { sourceRow: 3, studentName: 'Bea', action: 'insert', studentId: null },
          ],
          warnings: [], errors: [], hasBlockingErrors: false,
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('更新學生 1 筆')).not.toBeNull()
    expect(screen.getByText('新增學生 1 筆')).not.toBeNull()
    expect(screen.getByText('第 2 列：Ada → 更新學生 12')).not.toBeNull()
    expect(screen.getByText('第 3 列：Bea → 新增並由系統指派編號')).not.toBeNull()
  })

  it('shows the target season and cleared pre- and post-test totals', () => {
    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText('目標季度')).toBeNull()
    expect(screen.queryByText('前測將清空')).toBeNull()
    expect(screen.queryByText('後測將清空')).toBeNull()
    expect(screen.queryByText('目前資料庫')).toBeNull()
    expect(screen.getByText('新增報名 1 筆')).not.toBeNull()
    expect(screen.getByText('更新報名 1 筆')).not.toBeNull()
    expect(screen.getByText('課程 2 筆')).not.toBeNull()
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

  // 警告呈現與匯入期間的確認按鈕禁用必須同步驗證。
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

  it('moves focus to the cancel control when opened', () => {
    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(document.activeElement).toBe(screen.getByRole('button', { name: '取消' }))
  })

  it('keeps Tab and Shift+Tab within the dialog controls', () => {
    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const dialog = screen.getByRole('dialog')
    const cancel = screen.getByRole('button', { name: '取消' })
    const confirm = screen.getByRole('button', { name: '確認匯入' })

    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(confirm)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(cancel)
  })

  it('restores focus to the opener when closed', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const { unmount } = render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    screen.getByRole('button', { name: '取消' }).focus()

    unmount()

    expect(document.activeElement).toBe(opener)
    opener.remove()
  })
})
