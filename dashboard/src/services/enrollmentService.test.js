import { describe, expect, it, vi } from 'vitest'
import {
  createEnrollmentForm,
  createEnrollmentWithCourses,
  deleteEnrollment,
  deleteEnrollmentForm,
  updateEnrollmentForm,
  updateEnrollmentFormRefundStatus,
  updateEnrollmentPeriod,
  updateEnrollmentRefundStatus,
  updateEnrollmentWithCourses,
} from './enrollmentService'

describe('createEnrollmentForm / createEnrollmentWithCourses', () => {
  it('sends normalized enrollment payload to the create_member_enrollment RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: { enrollment_id: 42, form_id: 101, form_sequence: 1 }, error: null }),
    }

    const result = await createEnrollmentForm(client, '1', {
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      reg_type: '新生',
      refunded: false,
      refund_info: '',
      courses: ['A', ' B ', 'A', 'C'],
      prepaid_amount: '500',
      prepaid_receipt_number: 'P-1',
      tuition_fee: '2400',
      materials_fee: '300',
      membership_fee: '100',
      fee_receipt_number: 'F-1',
      handled_by_name: '經手人',
      handled_on: '2026-08-18',
      notes: '備註文字',
    })

    expect(client.rpc).toHaveBeenCalledWith('create_member_enrollment', {
      p_student_id: 1,
      p_enrollment: {
        period: '第16期',
        period_start_date: '2026-09-01',
        period_end_date: '2026-12-31',
        reg_type: '新生',
        refunded: false,
        refund_info: null,
        courses: ['A', 'B', 'C'],
        prepaid_amount: 500,
        prepaid_receipt_number: 'P-1',
        tuition_fee: 2400,
        materials_fee: 300,
        membership_fee: 100,
        fee_receipt_number: 'F-1',
        handled_by_name: '經手人',
        handled_on: '2026-08-18',
        reported_on: '2026-08-18',
        notes: '備註文字',
      },
    })
    expect(result).toEqual({ enrollment_id: 42, form_id: 101, form_sequence: 1 })
  })

  it('maps enrollment creation RPC errors to user-facing messages', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'ENROLLMENT_ALREADY_EXISTS' } }),
    }

    await expect(createEnrollmentForm(client, '1', {
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      reg_type: '新生',
      refunded: false,
      refund_info: '',
      courses: ['A'],
    })).rejects.toThrow('該會員在這個期別已經有相同的報名紀錄')
  })

  it('maps duplicate course in enrollment error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'DUPLICATE_COURSE_IN_ENROLLMENT' } }),
    }

    await expect(createEnrollmentForm(client, '1', {
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      reg_type: '續',
      courses: ['瑜伽'],
    })).rejects.toThrow('同一期別內已有其他報名表包含相同的課程')
  })

  it('maps period date mismatch error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'PERIOD_DATE_MISMATCH' } }),
    }

    await expect(createEnrollmentForm(client, '1', {
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      reg_type: '續',
      courses: ['瑜伽'],
    })).rejects.toThrow('報名表所屬期別的起訖日期與現有紀錄不一致')
  })
})

describe('updateEnrollmentForm', () => {
  it('updates form fields and courses via update_enrollment_form RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    await updateEnrollmentForm(client, 101, {
      reg_type: ' 一般 ',
      courses: [' 瑜伽 ', '有氧 '],
      notes: ' 備註 ',
      prepaid_amount: '500',
      prepaid_receipt_number: ' P-1 ',
      tuition_fee: 2000,
      materials_fee: '200',
      membership_fee: 100,
      fee_receipt_number: ' F-1 ',
      handled_by_name: ' 經手人 ',
      reported_on: ' 2026-08-20 ',
    })

    expect(client.rpc).toHaveBeenCalledWith('update_enrollment_form', {
      p_form_id: 101,
      p_form: {
        reg_type: '一般',
        courses: ['瑜伽', '有氧'],
        notes: '備註',
        prepaid_amount: 500,
        prepaid_receipt_number: 'P-1',
        tuition_fee: 2000,
        materials_fee: 200,
        membership_fee: 100,
        fee_receipt_number: 'F-1',
        handled_by_name: '經手人',
        reported_on: '2026-08-20',
        handled_on: '2026-08-20',
      },
    })
  })

  it('throws when no courses are selected', async () => {
    const client = { rpc: vi.fn() }
    await expect(
      updateEnrollmentForm(client, 101, { courses: [] })
    ).rejects.toThrow('請至少選擇一門課程')
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('maps COURSE_RECEIPT_LOCKED error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'COURSE_RECEIPT_LOCKED' } }),
    }

    await expect(
      updateEnrollmentForm(client, 101, { courses: ['有氧'] })
    ).rejects.toThrow('已有收據的課程不能移除')
  })
})

describe('updateEnrollmentFormRefundStatus', () => {
  it('calls set_enrollment_form_refund RPC with formId and refund details', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    await updateEnrollmentFormRefundStatus(client, 101, true, '退費原因')

    expect(client.rpc).toHaveBeenCalledWith('set_enrollment_form_refund', {
      p_form_id: 101,
      p_refunded: true,
      p_refund_info: '退費原因',
    })
  })
})

describe('deleteEnrollmentForm', () => {
  it('calls delete_enrollment_form RPC and returns result', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: { form_id: 101, enrollment_deleted: true }, error: null }),
    }

    const result = await deleteEnrollmentForm(client, 101)

    expect(client.rpc).toHaveBeenCalledWith('delete_enrollment_form', {
      p_form_id: 101,
    })
    expect(result).toEqual({ form_id: 101, enrollment_deleted: true })
  })

  it('maps permission error', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'ENROLLMENT_DELETE_FORBIDDEN' } }),
    }

    await expect(deleteEnrollmentForm(client, 101)).rejects.toThrow('只有管理員可以刪除報名單')
  })
})

describe('updateEnrollmentPeriod', () => {
  it('updates period and dates via update_enrollment_period RPC', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    }

    await updateEnrollmentPeriod(client, 10, {
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
    })

    expect(client.rpc).toHaveBeenCalledWith('update_enrollment_period', {
      p_enrollment_id: 10,
      p_period: '第16期',
      p_period_start_date: '2026-09-01',
      p_period_end_date: '2026-12-31',
    })
  })

  it('validates period and date inputs before calling RPC', async () => {
    const client = { rpc: vi.fn() }

    await expect(
      updateEnrollmentPeriod(client, 10, { period: '無效期別', period_start_date: '2026-09-01', period_end_date: '2026-12-31' })
    ).rejects.toThrow('請輸入有效期別，例如：第16期')

    await expect(
      updateEnrollmentPeriod(client, 10, { period: '第16期', period_start_date: '', period_end_date: '2026-12-31' })
    ).rejects.toThrow('請選擇開始日期與結束日期')

    await expect(
      updateEnrollmentPeriod(client, 10, { period: '第16期', period_start_date: '2026-12-31', period_end_date: '2026-09-01' })
    ).rejects.toThrow('結束日期不能早於開始日期')

    expect(client.rpc).not.toHaveBeenCalled()
  })
})

describe('legacy helpers', () => {
  describe('deleteEnrollment', () => {
    it('deletes an enrollment by enrollment_id', async () => {
      const calls = []
      const client = {
        from(table) {
          calls.push(table)
          return {
            delete() {
              return {
                eq: async (col, val) => {
                  calls.push({ col, val })
                  return { error: null }
                },
              }
            },
          }
        },
      }

      await deleteEnrollment(client, 42)
      expect(calls).toContain('enrollments')
      expect(calls).toContainEqual({ col: 'enrollment_id', val: 42 })
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
  })

  describe('updateEnrollmentRefundStatus', () => {
    it('updates enrollment refund status', async () => {
      const calls = []
      const client = {
        from(table) {
          calls.push({ table })
          return {
            update(values) {
              calls.push({ operation: 'update', values })
              return {
                eq: async (column, value) => {
                  calls.push({ operation: 'eq', column, value })
                  return { error: null }
                },
              }
            },
          }
        },
      }

      await updateEnrollmentRefundStatus(client, 42, true, null)
      expect(calls).toEqual([
        { table: 'enrollments' },
        { operation: 'update', values: { refunded: 1, refund_info: null } },
        { operation: 'eq', column: 'enrollment_id', value: 42 },
      ])
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
  })
})
