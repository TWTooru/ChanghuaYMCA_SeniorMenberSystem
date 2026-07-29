function firstReceipt(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

/**
 * Converts nested course and receipt rows into the UI's stable `courseDetails`
 * shape, handling relationship results returned as either arrays or objects.
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
 * Summarizes receipt-backed billing when present, otherwise preserves the
 * legacy enrollment `amount` and `invoice_number` fields as a fallback.
 */
export function summarizeEnrollmentBilling(enrollment) {
  const receipts = (enrollment.courseDetails || [])
    .map(course => course.receipt)
    .filter(Boolean)

  if (receipts.length === 0) {
    // Older enrollment rows predate course receipts, so their own fields remain the source of truth.
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
