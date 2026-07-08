import { describe, expect, it } from 'vitest'
import { createEnrollmentWithCourses } from './enrollmentService'

describe('createEnrollmentWithCourses', () => {
  it('inserts an enrollment and split course rows', async () => {
    const calls = []
    const client = {
      from(table) {
        if (table === 'enrollments') {
          return {
            insert(rows) {
              calls.push({ table, operation: 'insert', rows })
              return {
                select() {
                  return {
                    single: async () => ({ data: { enrollment_id: 42, student_id: '1' }, error: null })
                  }
                }
              }
            }
          }
        }

        return {
          insert: async rows => {
            calls.push({ table, operation: 'insert', rows })
            return { error: null }
          }
        }
      }
    }

    await expect(
      createEnrollmentWithCourses(client, '1', {
        season: '第十五期',
        reg_type: '續',
        pre_test: '2024-01-01',
        post_test: '2024-02-01',
        refunded: false,
        refund_info: '',
        courses: '肌力訓練, 北歐健走'
      })
    ).resolves.toEqual({ enrollment_id: 42, student_id: '1' })

    expect(calls).toEqual([
      {
        table: 'enrollments',
        operation: 'insert',
        rows: [{
          season: '第十五期',
          reg_type: '續',
          pre_test: '2024-01-01',
          post_test: '2024-02-01',
          refunded: 0,
          refund_info: '',
          student_id: '1'
        }]
      },
      {
        table: 'courses',
        operation: 'insert',
        rows: [
          { enrollment_id: 42, course_name: '肌力訓練' },
          { enrollment_id: 42, course_name: '北歐健走' }
        ]
      }
    ])
  })

  it('rolls back the inserted enrollment when course insertion fails', async () => {
    const calls = []
    const client = {
      from(table) {
        if (table === 'enrollments') {
          return {
            insert(rows) {
              calls.push({ table, operation: 'insert', rows })
              return {
                select() {
                  return {
                    single: async () => ({ data: { enrollment_id: 99 }, error: null })
                  }
                }
              }
            },
            delete() {
              calls.push({ table, operation: 'delete' })
              return {
                eq: async (column, value) => {
                  calls.push({ table, operation: 'eq', column, value })
                  return { error: null }
                }
              }
            }
          }
        }

        return {
          insert: async rows => {
            calls.push({ table, operation: 'insert', rows })
            return { error: new Error('course insert denied') }
          }
        }
      }
    }

    await expect(
      createEnrollmentWithCourses(client, '1', {
        season: '第十五期',
        reg_type: '續',
        pre_test: '',
        post_test: '',
        refunded: false,
        refund_info: '',
        courses: '肌力訓練'
      })
    ).rejects.toThrow('課程新增失敗')

    expect(calls).toContainEqual({ table: 'enrollments', operation: 'delete' })
    expect(calls).toContainEqual({
      table: 'enrollments',
      operation: 'eq',
      column: 'enrollment_id',
      value: 99
    })
  })

  it('reports when rollback fails after course insertion fails', async () => {
    const client = {
      from(table) {
        if (table === 'enrollments') {
          return {
            insert() {
              return {
                select() {
                  return {
                    single: async () => ({ data: { enrollment_id: 100 }, error: null })
                  }
                }
              }
            },
            delete() {
              return {
                eq: async () => ({ error: new Error('delete denied') })
              }
            }
          }
        }

        return {
          insert: async () => ({ error: new Error('course insert denied') })
        }
      }
    }

    await expect(
      createEnrollmentWithCourses(client, '1', {
        season: '第十五期',
        reg_type: '續',
        pre_test: '',
        post_test: '',
        refunded: false,
        refund_info: '',
        courses: '肌力訓練'
      })
    ).rejects.toThrow('rollback failed')
  })
})
