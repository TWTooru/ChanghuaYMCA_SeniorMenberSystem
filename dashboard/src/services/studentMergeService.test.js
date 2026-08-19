import { describe, it, expect, vi } from 'vitest';
import { mergeStudents } from './studentMergeService';

describe('studentMergeService', () => {
  it('should call rpc and return data on success', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: { source_id: 1, target_id: 2, moved_enrollments: 3, deleted_source: true },
        error: null
      })
    };

    const result = await mergeStudents(mockClient, 1, 2);
    expect(mockClient.rpc).toHaveBeenCalledWith('merge_students', { p_source_id: 1, p_target_id: 2 });
    expect(result).toEqual({ source_id: 1, target_id: 2, moved_enrollments: 3, deleted_source: true });
  });

  it('should map FORBIDDEN error to friendly message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'FORBIDDEN: only admin can merge students' }
      })
    };

    await expect(mergeStudents(mockClient, 1, 2)).rejects.toThrow('僅管理員可執行學員合併操作。');
  });

  it('should map SOURCE_NOT_FOUND error to friendly message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SOURCE_NOT_FOUND' }
      })
    };

    await expect(mergeStudents(mockClient, 1, 2)).rejects.toThrow('找不到來源學員，可能已被刪除。');
  });

  it('should map SAME_STUDENT error to friendly message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'SAME_STUDENT' }
      })
    };

    await expect(mergeStudents(mockClient, 1, 2)).rejects.toThrow('來源與目標不可為同一位學員。');
  });

  it('should map unknown error to default friendly message', async () => {
    const mockClient = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'unknown error occurred' }
      })
    };

    await expect(mergeStudents(mockClient, 1, 2)).rejects.toThrow('合併失敗：unknown error occurred');
  });
});
