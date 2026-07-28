function mapReceipt(row) {
  return {
    receiptId: row.receipt_id,
    courseId: row.course_id,
    amount: row.amount,
    invoiceNumber: row.invoice_number,
  }
}

function throwReceiptError(error) {
  if (error.code === '23505') {
    throw new Error('此課程已有收據，請重新整理後再編輯')
  }

  throw error
}

const INVALID_RECEIPT_ID_ERROR = '收據 ID 必須是大於 0 的整數'

export function normalizeCourseReceipt({ amount, invoice_number }) {
  const normalizedAmountText = String(amount ?? '').trim()
  const normalizedInvoiceNumber = String(invoice_number ?? '').trim()

  let normalizedAmount = null
  if (normalizedAmountText !== '') {
    if (!/^\d+$/.test(normalizedAmountText)) {
      throw new Error('金額必須為 0 或正整數')
    }
    normalizedAmount = Number(normalizedAmountText)
    if (!Number.isSafeInteger(normalizedAmount)) {
      throw new Error('金額必須為 0 或正整數')
    }
  }

  return {
    amount: normalizedAmount,
    invoice_number: normalizedInvoiceNumber || null,
  }
}

export async function createCourseReceipt(client, courseId, billing) {
  const payload = normalizeCourseReceipt(billing)
  const { data, error } = await client
    .from('course_receipts')
    .insert([{ course_id: courseId, ...payload }])
    .select()
    .single()

  if (error) throwReceiptError(error)
  return mapReceipt(data)
}

export async function updateCourseReceipt(client, receiptId, billing) {
  const payload = normalizeCourseReceipt(billing)
  const { data, error } = await client
    .from('course_receipts')
    .update(payload)
    .eq('receipt_id', receiptId)
    .select()
    .single()

  if (error) throwReceiptError(error)
  return mapReceipt(data)
}

export async function deleteCourseReceipt(client, receiptId) {
  if (!Number.isSafeInteger(receiptId) || receiptId <= 0) {
    throw new Error(INVALID_RECEIPT_ID_ERROR)
  }

  const { data, error } = await client
    .from('course_receipts')
    .delete()
    .eq('receipt_id', receiptId)
    .select('receipt_id')
    .single()

  if (error) throw error
  return { receiptId: data.receipt_id }
}
