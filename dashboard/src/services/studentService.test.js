import { describe, expect, it } from 'vitest'
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
  it('updates a student by student_id', async () => {
    const calls = []
    const client = {
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

  it('throws when delete fails', async () => {
    const client = {
      from() {
        return {
          delete() {
            return {
              eq: async () => ({ error: new Error('delete denied') })
            }
          }
        }
      }
    }

    await expect(deleteStudent(client, '1')).rejects.toThrow('delete denied')
  })
})
