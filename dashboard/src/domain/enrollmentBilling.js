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

export function normalizeEnrollmentBilling(courseRows = []) {
  const receiptMap = new Map()
  const courseDetails = courseRows.map(course => {
    const links = Array.isArray(course.billing_receipt_courses)
      ? course.billing_receipt_courses
      : course.billing_receipt_courses ? [course.billing_receipt_courses] : []

    let firstReceiptId = null
    let firstReceiptData = null

    for (const link of links) {
      const receipt = firstReceipt(link?.billing_receipts)
      if (!receipt) continue

      if (firstReceiptId === null) {
        firstReceiptId = receipt.receipt_id
        firstReceiptData = {
          receiptId: receipt.receipt_id,
          amount: receipt.amount,
          invoiceNumber: receipt.invoice_number,
        }
      }

      const normalizedReceipt = receiptMap.get(receipt.receipt_id) || {
        receiptId: receipt.receipt_id,
        amount: receipt.amount,
        invoiceNumber: receipt.invoice_number,
        courses: [],
      }
      if (!normalizedReceipt.courses.some(c => c.courseId === course.course_id)) {
        normalizedReceipt.courses.push({
          courseId: course.course_id,
          courseName: course.course_name,
        })
      }
      receiptMap.set(receipt.receipt_id, normalizedReceipt)
    }

    return {
      courseId: course.course_id,
      courseName: course.course_name,
      billingReceiptId: firstReceiptId,
      receipt: firstReceiptData,
    }
  })

  return { courseDetails, billingReceipts: [...receiptMap.values()] }
}

/**
 * 有收據時彙整以收據為準的帳務；否則保留舊版報名資料的
 * `amount` 與 `invoice_number` 欄位作為備援。
 */
export function summarizeEnrollmentBilling(enrollment) {
  const receipts = Array.isArray(enrollment.billingReceipts)
    ? enrollment.billingReceipts
    : (enrollment.courseDetails || []).map(course => course.receipt).filter(Boolean)

  if (receipts.length === 0) {
    // 舊版報名列早於課程收據機制，或為初次報名未產生收據之歷史紀錄
    const hasNewFields = enrollment.prepaid_amount != null || 
                         enrollment.tuition_fee != null || 
                         enrollment.materials_fee != null || 
                         enrollment.membership_fee != null

    if (hasNewFields) {
      const amounts = [enrollment.prepaid_amount, enrollment.tuition_fee, enrollment.materials_fee, enrollment.membership_fee].filter(v => v != null)
      const invoiceNumbers = [enrollment.prepaid_receipt_number, enrollment.fee_receipt_number]
        .map(n => String(n ?? '').trim())
        .filter(Boolean)

      return {
        amount: amounts.length > 0 ? amounts.reduce((a, b) => a + b, 0) : null,
        invoiceNumbers,
        source: 'legacy',
      }
    }

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
