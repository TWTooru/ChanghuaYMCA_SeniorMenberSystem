import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImportPreviewDialog from './ImportPreviewDialog'

const summary = { fileRows: 2, newStudents: 1, updatedStudents: 1, currentStudents: 8 }

describe('ImportPreviewDialog', () => {
  afterEach(cleanup)

  it('shows final member counts and confirms a valid import', () => {
    const onConfirm = vi.fn()

    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('檔案資料 2 列')).not.toBeNull()
    expect(screen.getByText('新增會員 1 位')).not.toBeNull()
    expect(screen.getByText('更新會員 1 位')).not.toBeNull()
    expect(screen.getByText('目前會員 8 位')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '確認匯入' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('shows matching reason and changed member fields', () => {
    render(
      <ImportPreviewDialog
        preview={{
          summary,
          studentResolutions: [
            { sourceRow: 2, studentName: 'Ada', action: 'update', studentId: 12, matchedBy: '電子郵件', changedFields: ['通訊處'] },
            { sourceRow: 3, studentName: 'Bea', action: 'insert', studentId: null, changedFields: [] },
          ],
          warnings: [], errors: [], hasBlockingErrors: false,
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText('第 2 列：Ada → 更新會員 12（依電子郵件；變更：通訊處）')).not.toBeNull()
    expect(screen.getByText('第 3 列：Bea → 新增並由系統指派編號')).not.toBeNull()
  })

  it('does not expose legacy enrollment or course counts', () => {
    render(
      <ImportPreviewDialog
        preview={{ summary, warnings: [], errors: [], hasBlockingErrors: false }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.queryByText(/報名/)).toBeNull()
    expect(screen.queryByText(/課程/)).toBeNull()
    expect(screen.getByText('新增會員 1 位')).not.toBeNull()
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
          warnings: [{ row: null, field: '識別資料', message: '缺少電子郵件及完整姓名、電話、出生年月日，將新增會員' }],
          errors: [],
          hasBlockingErrors: false,
        }}
        isImporting
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )

    expect(screen.getByText(/識別資料.*將新增會員/)).not.toBeNull()
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
