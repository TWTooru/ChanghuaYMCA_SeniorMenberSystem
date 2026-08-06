import { describe, expect, it, vi } from 'vitest'
import {
  createEnrollmentWithCourses,
  deleteEnrollment,
  updateEnrollmentRefundStatus,
  updateEnrollmentWithCourses,
} from './enrollmentService'

describe('createEnrollmentWithCourses', () => {
  it('calls the create_enrollment_with_courses RPC with normalized course names', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: 42, error: null }),
    }

    const result = await createEnrollmentWithCourses(client, '1', {
      season: '第十五季', reg_type: '續', pre_test: '', post_test: '',
      refunded: false, refund_info: '', courses: ['瑜珈', ' 太極拳 ', '瑜珈', ''],
    })

    expect(client.rpc).toHaveBeenCalledWith('create_enrollment_with_courses', {
      p_student_id: '1',
      p_season: '第十五季',
      p_reg_type: '續',
      p_pre_test: '',
      p_post_test: '',
      p_refunded: 0,
      p_refund_info: '',
      p_course_names: ['瑜珈', '太極拳'],
    })
    expect(result).toEqual({ enrollment_id: 42 })
  })

  it('throws when no courses are selected', async () => {
    const client = { rpc: vi.fn() }
    await expect(
      createEnrollmentWithCourses(client, '1', {
        season: '第十五季', reg_type: '新', pre_test: '', post_test: '',
        refunded: false, refund_info: '', courses: [],
      })
    ).rejects.toThrow('請至少選擇一門課程')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('throws when RPC returns an error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: '此學員在「第十五季」已存在選課紀錄' } }),
    }
    await expect(
      createEnrollmentWithCourses(client, '1', {
        season: '第十五季', reg_type: '續', pre_test: '', post_test: '',
        refunded: false, refund_info: '', courses: ['瑜珈'],
      })
    ).rejects.toThrow('此學員在「第十五季」已存在選課紀錄')
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
