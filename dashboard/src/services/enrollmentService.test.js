import { describe, expect, it, vi } from 'vitest'
import {
  createEnrollmentWithCourses,
  deleteEnrollment,
  updateEnrollmentBillingDetails,
  updateEnrollmentRefundStatus,
  updateEnrollmentWithCourses,
} from './enrollmentService'

describe('createEnrollmentWithCourses', () => {
  it('sends normalized grouped payment records to the enrollment RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: 42, error: null }),
    }

    const result = await createEnrollmentWithCourses(client, '1', {
      period: '第16期', reg_type: '新生',
      refunded: false, refund_info: '', courses: ['A', ' B ', 'A', 'C'],
      paymentRecords: [
        { localId: 'p1', courseNames: ['A'], amount: '1000', invoiceNumber: ' A001 ' },
        { localId: 'p2', courseNames: ['B', 'C'], amount: '2000', invoiceNumber: '' },
      ],
    })

    expect(client.rpc).toHaveBeenCalledWith('create_enrollment_with_courses', {
      p_student_id: 1,
      p_period: '第16期',
      p_reg_type: '新生',
      p_refunded: 0,
      p_refund_info: null,
      p_course_names: ['A', 'B', 'C'],
      p_payment_records: [
        { course_names: ['A'], amount: 1000, invoice_number: 'A001' },
        { course_names: ['B', 'C'], amount: 2000, invoice_number: null },
      ],
    })
    expect(result).toEqual({ enrollment_id: 42 })
  })

  it('maps enrollment creation RPC errors to user-facing messages', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'ENROLLMENT_ALREADY_EXISTS' } }),
    }

    await expect(createEnrollmentWithCourses(client, '1', {
      period: '第16期', reg_type: '新生',
      refunded: false, refund_info: '', courses: ['A'], paymentRecords: [],
    })).rejects.toThrow('該會員在這個期別已經有相同的報名紀錄')
  })

  it('throws when no courses are selected', async () => {
    const client = { rpc: vi.fn() }
    await expect(
      createEnrollmentWithCourses(client, '1', {
      period: '第15期', reg_type: '新',
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
        period: '第15期', reg_type: '續',
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

  it('maps foreign key violation to a user-friendly receipt error', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: { code: '23503', message: 'violates foreign key constraint "course_receipts_course_id_fkey"' },
          }),
        }),
      }),
    }

    await expect(deleteEnrollment(client, 1)).rejects.toThrow(
      '此選課紀錄的課程仍有收據，請先刪除所有課程收據後再刪除選課'
    )
  })

  it('maps grouped billing link violations to the same paid-course deletion error', async () => {
    const client = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            error: {
              code: '23503',
              message: 'update or delete on table "courses" violates foreign key constraint "billing_receipt_courses_course_id_fkey" on table "billing_receipt_courses"',
            },
          }),
        }),
      }),
    }

    await expect(deleteEnrollment(client, 1)).rejects.toThrow(
      '此選課紀錄的課程仍有收據，請先刪除所有課程收據後再刪除選課'
    )
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
      period: '第16期',
      reg_type: '續',
      refunded: false,
      refund_info: '',
      courses: [' 肌力訓練 ', '北歐健走', '肌力訓練'],
    })

    expect(rpc).toHaveBeenCalledWith('update_enrollment_with_courses', {
      p_enrollment_id: 42,
      p_period: '第16期',
      p_reg_type: '續',
      p_refunded: 0,
      p_refund_info: null,
      p_course_names: ['肌力訓練', '北歐健走'],
      p_payment_records: [],
    })
  })

  it('rejects an empty normalized course list before calling Supabase', async () => {
    const rpc = vi.fn()

    await expect(updateEnrollmentWithCourses({ rpc }, 42, {
      period: '第16期',
      reg_type: '續',
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

describe('updateEnrollmentBillingDetails', () => {
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
                },
              }
            },
          }
        },
      },
    }
  }

  it('normalizes inputs and updates enrollment billing details', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentBillingDetails(client, '42', {
      prepaid_amount: '500',
      prepaid_receipt_number: ' PRE-101 ',
      tuition_fee: 3000,
      materials_fee: '200',
      membership_fee: 100,
      fee_receipt_number: ' REC-202 ',
      handled_by_name: ' 王小明 ',
      handled_on: ' 2026-08-18 ',
      notes: ' 備註事項 ',
    })

    expect(calls).toEqual([
      { table: 'enrollments' },
      {
        operation: 'update',
        values: {
          prepaid_amount: 500,
          prepaid_receipt_number: 'PRE-101',
          tuition_fee: 3000,
          materials_fee: 200,
          membership_fee: 100,
          fee_receipt_number: 'REC-202',
          handled_by_name: '王小明',
          handled_on: '2026-08-18',
          notes: '備註事項',
        },
      },
      { operation: 'eq', column: 'enrollment_id', value: 42 },
    ])
  })

  it('converts empty strings, null, and undefined values to null', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentBillingDetails(client, 10, {
      prepaid_amount: '',
      prepaid_receipt_number: '   ',
      tuition_fee: null,
      materials_fee: undefined,
      membership_fee: '',
      fee_receipt_number: null,
      handled_by_name: '  ',
      handled_on: null,
      notes: undefined,
    })

    expect(calls).toContainEqual({
      operation: 'update',
      values: {
        prepaid_amount: null,
        prepaid_receipt_number: null,
        tuition_fee: null,
        materials_fee: null,
        membership_fee: null,
        fee_receipt_number: null,
        handled_by_name: null,
        handled_on: null,
        notes: null,
      },
    })
  })

  it('handles empty billingData object with defaults', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentBillingDetails(client, 10)

    expect(calls).toContainEqual({
      operation: 'update',
      values: {
        prepaid_amount: null,
        prepaid_receipt_number: null,
        tuition_fee: null,
        materials_fee: null,
        membership_fee: null,
        fee_receipt_number: null,
        handled_by_name: null,
        handled_on: null,
        notes: null,
      },
    })
  })

  it('throws error when amount is invalid or negative', async () => {
    const { client } = createUpdateClient()

    await expect(
      updateEnrollmentBillingDetails(client, 10, { prepaid_amount: -50 })
    ).rejects.toThrow('金額必須為非負整數')

    await expect(
      updateEnrollmentBillingDetails(client, 10, { tuition_fee: 'invalid' })
    ).rejects.toThrow('金額必須為非負整數')
  })

  it('throws when database update fails', async () => {
    const updateError = new Error('update permission denied')
    const { client } = createUpdateClient({ error: updateError })

    await expect(
      updateEnrollmentBillingDetails(client, 10, { tuition_fee: 1000 })
    ).rejects.toBe(updateError)
  })
})
