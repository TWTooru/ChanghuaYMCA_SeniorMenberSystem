import { normalizePaymentAmount } from '../domain/enrollmentPayments'

function mapReceipt(data) {
  return {
    receiptId: data.receipt_id,
    courseIds: data.course_ids || [],
    amount: data.amount,
    invoiceNumber: data.invoice_number,
  }
}

function mapReceiptError(message) {
  return {
    PAYMENT_FORBIDDEN: '您沒有管理付款資料的權限',
    PAYMENT_COURSE_REQUIRED: '請至少選擇一門課程',
    PAYMENT_AMOUNT_REQUIRED: '請輸入付款金額',
    PAYMENT_AMOUNT_INVALID: '付款金額必須是 0 或正整數',
    PAYMENT_COURSE_NOT_FOUND: '找不到指定的報名課程',
    PAYMENT_CROSS_ENROLLMENT: '付款資料中的課程必須屬於同一筆報名紀錄',
    PAYMENT_ALREADY_EXISTS: '所選課程已經有付款資料',
    PAYMENT_NOT_FOUND: '找不到指定的付款資料',
  }[message] || message
}

function normalizeBilling(billing) {
  return {
    amount: normalizePaymentAmount(billing.amount),
    invoiceNumber: String(billing.invoiceNumber ?? '').trim() || null,
  }
}

export async function createBillingReceipt(client, courseIds, billing) {
  const normalized = normalizeBilling(billing)
  const { data, error } = await client.rpc('create_billing_receipt', {
    p_course_ids: courseIds,
    p_amount: normalized.amount,
    p_invoice_number: normalized.invoiceNumber,
  })
  if (error) throw new Error(mapReceiptError(error.message))
  return mapReceipt(data)
}

export async function updateBillingReceipt(client, receiptId, billing) {
  const normalized = normalizeBilling(billing)
  const { data, error } = await client.rpc('update_billing_receipt', {
    p_receipt_id: receiptId,
    p_amount: normalized.amount,
    p_invoice_number: normalized.invoiceNumber,
  })
  if (error) throw new Error(mapReceiptError(error.message))
  return mapReceipt(data)
}

export async function deleteBillingReceipt(client, receiptId) {
  const { error } = await client.rpc('delete_billing_receipt', { p_receipt_id: receiptId })
  if (error) throw new Error(mapReceiptError(error.message))
}
