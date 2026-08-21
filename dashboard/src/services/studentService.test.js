import { describe, expect, it, vi } from 'vitest'
import { createStudent, updateStudent, deleteStudent } from './studentService'

describe('createStudent', () => {
  it('inserts a student row and returns the result', async () => {
    const studentData = { student_id: '99', name: '測試學員', gender: '男' }
    const client = {
      from(table) {
        return {
          insert: async (rows) => {
            expect(table).toBe('students')
            expect(rows).toEqual([studentData])
            return { error: null }
          }
        }
      }
    }

    await expect(createStudent(client, studentData)).resolves.toBeUndefined()
  })

  it('throws when insert fails', async () => {
    const client = {
      from() {
        return {
          insert: async () => ({ error: new Error('duplicate key') })
        }
      }
    }

    await expect(createStudent(client, { student_id: '1', name: 'x' })).rejects.toThrow('duplicate key')
  })
})

describe('updateStudent', () => {
  it('updates a complete profile through the atomic RPC', async () => {
    const updated = { student_id: '12', name: 'Ada' }
    const client = { rpc: vi.fn().mockResolvedValue({ data: updated, error: null }) }

    await expect(updateStudent(client, 'S-001', updated)).resolves.toEqual(updated)
    expect(client.rpc).toHaveBeenCalledWith('update_student_profile', {
      p_original_id: 'S-001',
      p_student: updated,
    })
  })
  it('updates a student by student_id', async () => {
    const calls = []
    const client = {
      rpc(_name, args) {
        calls.push({ op: 'update', payload: args.p_student })
        calls.push({ op: 'eq', col: 'student_id', val: args.p_original_id })
        return Promise.resolve({ data: null, error: null })
      },
      from(table) {
        calls.push(table)
        return {
          update(payload) {
            calls.push({ op: 'update', payload })
            return {
              eq: async (col, val) => {
                calls.push({ op: 'eq', col, val })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await updateStudent(client, 'S-001', { name: '新名字' })
    expect(calls).toContainEqual({ op: 'update', payload: { name: '新名字' } })
    expect(calls).toContainEqual({ op: 'eq', col: 'student_id', val: 'S-001' })
  })

  it('throws when update fails', async () => {
    const client = {
      rpc: async () => ({ data: null, error: new Error('update denied') }),
      from() {
        return {
          update() {
            return {
              eq: async () => ({ error: new Error('update denied') })
            }
          }
        }
      }
    }

    await expect(updateStudent(client, '1', {})).rejects.toThrow('update denied')
  })
})

describe('deleteStudent', () => {
  function deleteClient(error) {
    return {
      from: () => ({
        delete: () => ({
          eq: async () => ({ error }),
        }),
      }),
    }
  }

  it('deletes a student by student_id (DB cascade handles children)', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push(table)
        return {
          delete() {
            calls.push('delete')
            return {
              eq: async (col, val) => {
                calls.push({ col, val })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await deleteStudent(client, 'S-001')
    expect(calls).toContain('students')
    expect(calls).toContainEqual({ col: 'student_id', val: 'S-001' })
  })

  it('maps foreign-key deletion failures to a stable Chinese message', async () => {
    const error = { code: '23503', message: 'violates foreign key constraint' }
    await expect(deleteStudent(deleteClient(error), '1'))
      .rejects.toThrow('無法刪除此學員：尚有關聯的報名紀錄或收據，請先清理後再試。')
  })

  it('preserves unrelated deletion errors', async () => {
    const error = new Error('delete denied')
    await expect(deleteStudent(deleteClient(error), '1')).rejects.toBe(error)
  })
})
