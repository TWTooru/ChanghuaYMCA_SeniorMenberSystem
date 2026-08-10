import { describe, expect, it, vi } from 'vitest'
import {
  createBillingReceipt,
  deleteBillingReceipt,
  updateBillingReceipt,
} from './billingReceiptService'

describe('billing receipt service', () => {
  it('creates a receipt with a normalized payment payload and maps its result', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: { receipt_id: 'receipt-42', course_ids: ['course-1', 'course-2'], amount: 1200, invoice_number: 'INV-42' },
        error: null,
      }),
    }

    await expect(createBillingReceipt(client, ['course-1', 'course-2'], {
      amount: '1200', invoiceNumber: ' INV-42 ',
    })).resolves.toEqual({
      receiptId: 'receipt-42', courseIds: ['course-1', 'course-2'], amount: 1200, invoiceNumber: 'INV-42',
    })
    expect(client.rpc).toHaveBeenCalledWith('create_billing_receipt', {
      p_course_ids: ['course-1', 'course-2'], p_amount: 1200, p_invoice_number: 'INV-42',
    })
  })

  it('updates a receipt with a normalized payload and maps an empty invoice to null', async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: { receipt_id: 'receipt-42', course_ids: ['course-1'], amount: 0, invoice_number: null },
        error: null,
      }),
    }

    await expect(updateBillingReceipt(client, 'receipt-42', { amount: '0', invoiceNumber: ' ' })).resolves.toEqual({
      receiptId: 'receipt-42', courseIds: ['course-1'], amount: 0, invoiceNumber: null,
    })
    expect(client.rpc).toHaveBeenCalledWith('update_billing_receipt', {
      p_receipt_id: 'receipt-42', p_amount: 0, p_invoice_number: null,
    })
  })

  it('deletes a receipt through the grouped receipt RPC', async () => {
    const client = { rpc: vi.fn().mockResolvedValue({ error: null }) }

    await expect(deleteBillingReceipt(client, 'receipt-42')).resolves.toBeUndefined()
    expect(client.rpc).toHaveBeenCalledWith('delete_billing_receipt', { p_receipt_id: 'receipt-42' })
  })

  it.each([
    ['PAYMENT_FORBIDDEN', '您沒有管理付款資料的權限'],
    ['PAYMENT_COURSE_REQUIRED', '請至少選擇一門課程'],
    ['PAYMENT_AMOUNT_REQUIRED', '請輸入付款金額'],
    ['PAYMENT_AMOUNT_INVALID', '付款金額必須是 0 或正整數'],
    ['PAYMENT_COURSE_NOT_FOUND', '找不到指定的報名課程'],
    ['PAYMENT_CROSS_ENROLLMENT', '付款資料中的課程必須屬於同一筆報名紀錄'],
    ['PAYMENT_ALREADY_EXISTS', '所選課程已經有付款資料'],
    ['PAYMENT_NOT_FOUND', '找不到指定的付款資料'],
  ])('maps receipt RPC error %s to a user-facing message', async (message, expectedMessage) => {
    const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: { message } }) }

    await expect(deleteBillingReceipt(client, 'missing')).rejects.toThrow(expectedMessage)
  })
})
