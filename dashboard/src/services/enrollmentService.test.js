import { describe, expect, it } from 'vitest'
import {
  createEnrollmentWithCourses,
  deleteEnrollment,
  normalizeEnrollmentBilling,
  updateEnrollmentBilling,
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

describe('normalizeEnrollmentBilling', () => {
  it.each([
    [{ amount: '', invoice_number: '  ' }, { amount: null, invoice_number: null }],
    [{ amount: '0', invoice_number: ' AB12345678 ' }, { amount: 0, invoice_number: 'AB12345678' }],
    [{ amount: '1200', invoice_number: 'CD87654321' }, { amount: 1200, invoice_number: 'CD87654321' }],
  ])('normalizes billing values', (input, expected) => {
    expect(normalizeEnrollmentBilling(input)).toEqual(expected)
  })

  it.each(['-1', '1.5', 'abc', '9007199254740992'])('rejects invalid amount %s', amount => {
    expect(() => normalizeEnrollmentBilling({ amount, invoice_number: '' }))
      .toThrow('金額必須為 0 或正整數')
  })
})

describe('updateEnrollmentBilling', () => {
  it('updates only normalized billing fields', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push({ table })
        return {
          update(payload) {
            calls.push({ payload })
            return {
              eq: async (column, value) => {
                calls.push({ column, value })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await expect(updateEnrollmentBilling(client, 42, {
      amount: '1200',
      invoice_number: ' AB12345678 ',
      season: 'must not be sent',
    })).resolves.toEqual({
      amount: 1200,
      invoice_number: 'AB12345678',
    })

    expect(calls).toEqual([
      { table: 'enrollments' },
      { payload: { amount: 1200, invoice_number: 'AB12345678' } },
      { column: 'enrollment_id', value: 42 },
    ])
  })

  it('throws the Supabase update error', async () => {
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

    await expect(updateEnrollmentBilling(client, 42, {
      amount: '',
      invoice_number: '',
    })).rejects.toThrow('update denied')
  })
})

