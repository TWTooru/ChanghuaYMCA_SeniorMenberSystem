/**
 * 封裝 `course_receipts` 的建立、更新與刪除，將資料庫資料列轉為介面的計費資料形狀。
 * 唯一性限制與資料庫存取政策錯誤會保留其現有的可處理錯誤語意。
 */
/** 將 `course_receipts` 資料列轉為介面的計費資料形狀。 */
function mapReceipt(row) {
  return {
    receiptId: row.receipt_id,
    courseId: row.course_id,
    amount: row.amount,
    invoiceNumber: row.invoice_number,
  }
}

/** 將唯一性違反轉為可透過重新整理恢復的收據衝突訊息。 */
function throwReceiptError(error) {
  if (error.code === '23505') {
    throw new Error('此課程已有收據，請重新整理後再編輯')
  }

  throw error
}

const INVALID_RECEIPT_ID_ERROR = '收據 ID 必須是大於 0 的整數'

/** 驗證並正規化收據金額與發票號碼；空值會儲存為 `null`。 */
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

/** 為指定課程建立一筆 `course_receipts` 收據，並回傳介面的計費資料形狀。 */
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

/** 僅更新既有收據的計費欄位，避免由介面改寫其所屬課程。 */
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

/** 驗證正整數收據 ID 後刪除 `course_receipts` 資料列，並回傳已刪除的 ID。 */
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
