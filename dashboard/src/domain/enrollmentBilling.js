function firstReceipt(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

/**
 * 將巢狀課程與收據列轉換為 UI 穩定使用的 `courseDetails` 形狀，
 * 並處理關聯結果可能以陣列或物件傳回的情況。
 */
export function normalizeCourseDetails(courseRows = []) {
  return courseRows.map(course => {
    const rawReceipt = firstReceipt(course.course_receipts)
    return {
      courseId: course.course_id,
      courseName: course.course_name,
      receipt: rawReceipt
        ? {
            receiptId: rawReceipt.receipt_id,
            amount: rawReceipt.amount,
            invoiceNumber: rawReceipt.invoice_number,
          }
        : null,
    }
  })
}

/**
 * 有收據時彙整以收據為準的帳務；否則保留舊版報名資料的
 * `amount` 與 `invoice_number` 欄位作為備援。
 */
export function summarizeEnrollmentBilling(enrollment) {
  const receipts = (enrollment.courseDetails || [])
    .map(course => course.receipt)
    .filter(Boolean)

  if (receipts.length === 0) {
    // 舊版報名列早於課程收據機制，其自身欄位仍是資料依據。
    const invoice = String(enrollment.invoice_number ?? '').trim()
    return {
      amount: enrollment.amount == null ? null : enrollment.amount,
      invoiceNumbers: invoice ? [invoice] : [],
      source: 'legacy',
    }
  }

  const amounts = receipts.map(receipt => receipt.amount).filter(amount => amount != null)
  const invoiceNumbers = [...new Set(
    receipts.map(receipt => String(receipt.invoiceNumber ?? '').trim()).filter(Boolean)
  )]

  return {
    amount: amounts.length ? amounts.reduce((sum, amount) => sum + amount, 0) : null,
    invoiceNumbers,
    source: 'receipts',
  }
}
