import { describe, expect, it, vi } from 'vitest'
import {
  createEnrollmentWithCourses,
  deleteEnrollment,
  updateEnrollmentRefundStatus,
  updateEnrollmentWithCourses,
} from './enrollmentService'

describe('createEnrollmentWithCourses', () => {
  it('inserts deduplicated selected course rows', async () => {
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
        season: '第十五季',
        reg_type: '續',
        pre_test: '2024-01-01',
        post_test: '2024-02-01',
        refunded: false,
        refund_info: '',
        courses: ['Course A', 'Course B', 'Course A']
      })
    ).resolves.toEqual({ enrollment_id: 42, student_id: '1' })

    expect(calls).toEqual([
      {
        table: 'enrollments',
        operation: 'insert',
        rows: [{
          season: '第十五季',
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
          { enrollment_id: 42, course_name: 'Course A' },
          { enrollment_id: 42, course_name: 'Course B' }
        ]
      }
    ])
  })

  it('removes blank selected course names and skips course insertion when none remain', async () => {
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
                    single: async () => ({ data: { enrollment_id: 43, student_id: '1' }, error: null })
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

    await expect(createEnrollmentWithCourses(client, '1', {
      season: 'spring', reg_type: 'regular', pre_test: '', post_test: '',
      refunded: false, refund_info: '', courses: [' ', '', '  ']
    })).resolves.toEqual({ enrollment_id: 43, student_id: '1' })

    expect(calls).toEqual([
      {
        table: 'enrollments',
        operation: 'insert',
        rows: [{
          season: 'spring', reg_type: 'regular', pre_test: '', post_test: '',
          refunded: 0, refund_info: '', student_id: '1'
        }]
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
        season: '第十五季',
        reg_type: '續',
        pre_test: '',
        post_test: '',
        refunded: false,
        refund_info: '',
        courses: ['Course A']
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
        season: '第十五季',
        reg_type: '續',
        pre_test: '',
        post_test: '',
        refunded: false,
        refund_info: '',
        courses: ['Course A']
      })
    ).rejects.toThrow('rollback failed')
  })
})

describe('deleteEnrollment', () => {
  it('deletes an enrollment by enrollment_id (DB cascade handles courses)', async () => {
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

    await deleteEnrollment(client, 42)
    expect(calls).toContain('enrollments')
    expect(calls).toContainEqual({ col: 'enrollment_id', val: 42 })
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

    await expect(deleteEnrollment(client, 1)).rejects.toThrow('delete denied')
  })
})

describe('updateEnrollmentRefundStatus', () => {
  function createUpdateClient(result = { error: null }) {
    const calls = []
    return {
      calls,
      client: {
        from(table) {
          calls.push({ table })
          return {
            update(values) {
              calls.push({ operation: 'update', values })
              return {
                eq: async (column, value) => {
                  calls.push({ operation: 'eq', column, value })
                  return result
                }
              }
            }
          }
        }
      }
    }
  }

  it('marks an enrollment refunded with null refund info', async () => {
    const { client, calls } = createUpdateClient()

    await expect(updateEnrollmentRefundStatus(client, 42, true, null)).resolves.toBeUndefined()

    expect(calls).toEqual([
      { table: 'enrollments' },
      { operation: 'update', values: { refunded: 1, refund_info: null } },
      { operation: 'eq', column: 'enrollment_id', value: 42 },
    ])
  })

  it('unmarks a refund and clears the refund info', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentRefundStatus(client, 43, false, null)

    expect(calls).toContainEqual({ operation: 'update', values: { refunded: 0, refund_info: null } })
  })

  it('retains supplied refund info when marking an enrollment refunded', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentRefundStatus(client, 44, true, 'Customer request')

    expect(calls).toContainEqual({ operation: 'update', values: { refunded: 1, refund_info: 'Customer request' } })
  })

  it('throws update errors', async () => {
    const updateError = new Error('update denied')
    const { client } = createUpdateClient({ error: updateError })

    await expect(updateEnrollmentRefundStatus(client, 45, true, null)).rejects.toBe(updateError)
  })
})

describe('updateEnrollmentWithCourses', () => {
  it('updates enrollment metadata and selected courses through one atomic RPC', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    const client = { rpc }

    await updateEnrollmentWithCourses(client, 42, {
      season: '第十六季',
      reg_type: '續',
      pre_test: '',
      post_test: '',
      refunded: false,
      refund_info: '',
      courses: [' 肌力訓練 ', '北歐健走', '肌力訓練'],
    })

    expect(rpc).toHaveBeenCalledWith('update_enrollment_with_courses', {
      p_enrollment_id: 42,
      p_season: '第十六季',
      p_reg_type: '續',
      p_pre_test: '',
      p_post_test: '',
      p_refunded: 0,
      p_refund_info: '',
      p_course_names: ['肌力訓練', '北歐健走'],
    })
  })

  it('rejects an empty normalized course list before calling Supabase', async () => {
    const rpc = vi.fn()

    await expect(updateEnrollmentWithCourses({ rpc }, 42, {
      season: '第十六季',
      reg_type: '續',
      pre_test: '',
      post_test: '',
      refunded: false,
      refund_info: '',
      courses: [' ', ''],
    })).rejects.toThrow('請至少選擇一門課程')
    expect(rpc).not.toHaveBeenCalled()
  })

  it.each([
    ['COURSE_RECEIPT_LOCKED', '已有收據的課程不能移除'],
    ['COURSE_REQUIRED', '請至少選擇一門課程'],
    ['database unavailable', 'database unavailable'],
  ])('maps RPC error "%s" to "%s"', async (message, expectedMessage) => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message },
      }),
    }

    await expect(updateEnrollmentWithCourses(client, 42, {
      season: '第十六季',
      reg_type: '續',
      pre_test: '',
      post_test: '',
      refunded: false,
      refund_info: '',
      courses: ['肌力訓練'],
    })).rejects.toThrow(expectedMessage)
  })
})
