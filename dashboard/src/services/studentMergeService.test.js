import { describe, it, expect, vi } from 'vitest'
import { mergeStudents } from './studentMergeService'

describe('studentMergeService', () => {
  it('calls rpc with string student IDs', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { source_id: '1', target_id: '2', moved_enrollments: 3, deleted_source: true },
        error: null,
      }),
    }
    const result = await mergeStudents(mockClient, 1, 2)
    expect(mockClient.rpc).toHaveBeenCalledWith('merge_students', { p_source_id: '1', p_target_id: '2' })
    expect(result.moved_enrollments).toBe(3)
  })

  it('maps FORBIDDEN error to friendly Chinese message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'FORBIDDEN: only admin can merge students' },
      }),
    }
    await expect(mergeStudents(mockClient, '1', '2')).rejects.toThrow('僅管理員可執行學員合併操作')
  })

  it('maps SOURCE_NOT_FOUND error to friendly Chinese message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SOURCE_NOT_FOUND: student 99 does not exist' },
      }),
    }
    await expect(mergeStudents(mockClient, '99', '2')).rejects.toThrow('找不到來源學員，可能已被刪除')
  })

  it('maps SAME_STUDENT error to friendly Chinese message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SAME_STUDENT: cannot merge a student into themselves' },
      }),
    }
    await expect(mergeStudents(mockClient, '1', '1')).rejects.toThrow('來源與目標不可為同一位學員')
  })
})
