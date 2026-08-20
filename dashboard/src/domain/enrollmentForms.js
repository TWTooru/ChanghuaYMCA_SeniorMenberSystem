export function normalizeEnrollmentForm(rawForm = {}) {
  const rawCourses = Array.isArray(rawForm.courses) ? rawForm.courses : []
  const courseDetails = rawCourses.map(course => ({
    courseId: course.course_id,
    courseName: course.course_name,
  }))
  const courses = courseDetails.map(c => c.courseName)

  const rawReceipts = Array.isArray(rawForm.billing_receipts) ? rawForm.billing_receipts : []
  const billingReceipts = rawReceipts.map(receipt => ({
    receiptId: receipt.receipt_id,
    receiptKind: receipt.receipt_kind,
    amount: receipt.amount,
    invoiceNumber: receipt.invoice_number,
  }))

  const prepaidReceipt = billingReceipts.find(r => r.receiptKind === 'prepaid')
  const formalReceipt = billingReceipts.find(r => r.receiptKind === 'formal')
  const otherReceipts = billingReceipts.filter(r => r.receiptKind === 'other')

  return {
    ...rawForm,
    form_id: rawForm.form_id,
    form_sequence: rawForm.form_sequence,
    reg_type: rawForm.reg_type,
    tuition_fee: rawForm.tuition_fee ?? null,
    materials_fee: rawForm.materials_fee ?? null,
    membership_fee: rawForm.membership_fee ?? null,
    handled_by_name: rawForm.handled_by_name ?? null,
    handled_by_user_id: rawForm.handled_by_user_id ?? null,
    handled_by_account: rawForm.handled_by_account ?? null,
    reported_on: rawForm.reported_on ?? rawForm.handled_on ?? null,
    notes: rawForm.notes ?? null,
    refunded: Boolean(rawForm.refunded),
    refund_info: rawForm.refund_info ?? null,
    courses,
    courseDetails,
    billingReceipts,
    prepaid_amount: prepaidReceipt ? prepaidReceipt.amount : (rawForm.prepaid_amount ?? null),
    prepaid_receipt_number: prepaidReceipt?.invoiceNumber ?? rawForm.prepaid_receipt_number ?? null,
    fee_receipt_number: formalReceipt?.invoiceNumber ?? rawForm.fee_receipt_number ?? null,
    otherReceipts,
  }
}

export function normalizeEnrollmentForms(rawForms = []) {
  if (!Array.isArray(rawForms)) return []
  return rawForms
    .map(normalizeEnrollmentForm)
    .sort((a, b) => (a.form_sequence || 0) - (b.form_sequence || 0))
}

export function getEnrollmentRefundStatus(forms = []) {
  if (!Array.isArray(forms) || forms.length === 0) {
    return 'normal'
  }
  const refundedCount = forms.filter(f => Boolean(f.refunded)).length
  if (refundedCount === 0) return 'normal'
  if (refundedCount === forms.length) return 'refunded'
  return 'partial'
}

export function summarizeEnrollmentFormBilling(form = {}) {
  const feeAmounts = [form.tuition_fee, form.materials_fee, form.membership_fee].filter(v => v != null)
  const formalAmount = feeAmounts.length > 0 ? feeAmounts.reduce((a, b) => a + b, 0) : null
  const prepaidAmount = form.prepaid_amount != null ? form.prepaid_amount : null

  const prepaidReceiptNumber = form.prepaid_receipt_number ? String(form.prepaid_receipt_number).trim() : ''
  const formalReceiptNumber = form.fee_receipt_number ? String(form.fee_receipt_number).trim() : ''

  const allReceiptInvoices = (form.billingReceipts || [])
    .map(r => String(r.invoiceNumber ?? '').trim())
    .filter(Boolean)

  const invoiceNumbers = [...new Set([
    prepaidReceiptNumber,
    formalReceiptNumber,
    ...allReceiptInvoices,
  ].filter(Boolean))]

  return {
    prepaidAmount,
    formalAmount,
    prepaidReceiptNumber,
    formalReceiptNumber,
    invoiceNumbers,
  }
}
