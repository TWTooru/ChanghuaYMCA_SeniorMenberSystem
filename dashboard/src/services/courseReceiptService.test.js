import { describe, expect, it } from 'vitest'
import {
  createCourseReceipt,
  deleteCourseReceipt,
  normalizeCourseReceipt,
  updateCourseReceipt,
} from './courseReceiptService'

function createReceiptClient(calls, result) {
  return {
    from(table) {
      calls.push({ table })
      return {
        insert(rows) {
          calls.push({ operation: 'insert', rows })
          return {
            select() {
              calls.push({ operation: 'select' })
              return { single: async () => result }
            },
          }
        },
        update(payload) {
          calls.push({ operation: 'update', payload })
          return {
            eq(column, value) {
              calls.push({ operation: 'eq', column, value })
              return {
                select() {
                  calls.push({ operation: 'select' })
                  return { single: async () => result }
                },
              }
            },
          }
        },
      }
    },
  }
}

function createDeleteReceiptClient(calls, result) {
  return {
    from(table) {
      calls.push({ table })
      return {
        delete() {
          calls.push({ operation: 'delete' })
          return {
            eq(column, value) {
              calls.push({ operation: 'eq', column, value })
              return {
                select(columns) {
                  calls.push({ operation: 'select', columns })
                  return { single: async () => result }
                },
              }
            },
          }
        },
      }
    },
  }
}

describe('normalizeCourseReceipt', () => {
  it.each([
    [{ amount: '', invoice_number: '  ' }, { amount: null, invoice_number: null }],
    [{ amount: '0', invoice_number: ' AB12345678 ' }, { amount: 0, invoice_number: 'AB12345678' }],
    [{ amount: '1200', invoice_number: 'CD87654321' }, { amount: 1200, invoice_number: 'CD87654321' }],
  ])('normalizes receipt values', (input, expected) => {
    expect(normalizeCourseReceipt(input)).toEqual(expected)
  })

  it.each(['-1', '1.5', 'abc', '9007199254740992'])('rejects invalid amount %s', amount => {
    expect(() => normalizeCourseReceipt({ amount, invoice_number: '' }))
      .toThrow('金額必須為 0 或正整數')
  })
})

describe('createCourseReceipt', () => {
  it('creates a blank receipt for an enrolled course', async () => {
    const calls = []
    const client = createReceiptClient(calls, {
      data: {
        receipt_id: 5,
        course_id: 10,
        amount: null,
        invoice_number: null,
      },
      error: null,
    })

    await expect(createCourseReceipt(client, 10, {
      amount: '',
      invoice_number: '  ',
    })).resolves.toEqual({
      receiptId: 5,
      courseId: 10,
      amount: null,
      invoiceNumber: null,
    })

    expect(calls).toContainEqual({
      operation: 'insert',
      rows: [{ course_id: 10, amount: null, invoice_number: null }],
    })
  })

  it('maps a duplicate receipt insertion to a refreshable error', async () => {
    const client = createReceiptClient([], {
      data: null,
      error: { code: '23505', message: 'duplicate key value violates unique constraint' },
    })

    await expect(createCourseReceipt(client, 10, {
      amount: '',
      invoice_number: '',
    })).rejects.toThrow('此課程已有收據，請重新整理後再編輯')
  })
})

describe('updateCourseReceipt', () => {
  it('updates only receipt billing fields and returns the saved receipt', async () => {
    const calls = []
    const client = createReceiptClient(calls, {
      data: {
        receipt_id: 5,
        course_id: 10,
        amount: 1200,
        invoice_number: 'AB12345678',
      },
      error: null,
    })

    await expect(updateCourseReceipt(client, 5, {
      amount: '1200',
      invoice_number: ' AB12345678 ',
      course_id: 'must not be sent',
    })).resolves.toEqual({
      receiptId: 5,
      courseId: 10,
      amount: 1200,
      invoiceNumber: 'AB12345678',
    })

    expect(calls).toContainEqual({
      operation: 'update',
      payload: { amount: 1200, invoice_number: 'AB12345678' },
    })
    expect(calls).toContainEqual({ operation: 'eq', column: 'receipt_id', value: 5 })
  })
})

describe('deleteCourseReceipt', () => {
  it('deletes a receipt and returns its id', async () => {
    const calls = []
    const client = createDeleteReceiptClient(calls, {
      data: { receipt_id: 5 },
      error: null,
    })

    await expect(deleteCourseReceipt(client, 5)).resolves.toEqual({ receiptId: 5 })

    expect(calls).toEqual([
      { table: 'course_receipts' },
      { operation: 'delete' },
      { operation: 'eq', column: 'receipt_id', value: 5 },
      { operation: 'select', columns: 'receipt_id' },
    ])
  })

  it.each([null, 'c5df2f0a-43c2-4fd8-a7e5-0d7d19a9c571', 0, -1])(
    'rejects invalid receipt id %p before querying Supabase',
    async receiptId => {
      const calls = []
      const client = createDeleteReceiptClient(calls, { data: null, error: null })

      await expect(deleteCourseReceipt(client, receiptId)).rejects.toThrow()
      expect(calls).toEqual([])
    },
  )

  it('throws the Supabase error when deletion is denied', async () => {
    const client = createDeleteReceiptClient([], {
      data: null,
      error: new Error('delete denied'),
    })

    await expect(deleteCourseReceipt(client, 5)).rejects.toThrow('delete denied')
  })
})
