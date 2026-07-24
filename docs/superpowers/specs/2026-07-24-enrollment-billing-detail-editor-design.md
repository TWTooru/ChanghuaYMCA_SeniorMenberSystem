# Enrollment Billing Detail Editor

## Goal

Make each row in the historical enrollment table open a focused detail view where authorized staff can edit only that enrollment's amount and invoice number, then review the student's basic information below.

## Scope

- Change the row-click behavior in `EnrollmentTab`.
- Replace the current non-tabbed student-detail view used by this page with a dedicated enrollment billing detail modal.
- Keep the normal student-detail experience opened from the student list unchanged.
- Do not show the student course trend or enrollment timeline in the new billing detail modal.
- Do not add billing fields to enrollment creation, the existing full enrollment editor, CSV/Excel import, or export.

## Interaction

Clicking a history-table row opens the billing detail modal for that exact enrollment.

The modal is ordered as follows:

1. Enrollment context: student name, season, courses, and refund status.
2. Billing editor: amount, invoice number, and an independent save button.
3. Read-only student details using the existing student information presentation.

The modal can be closed without changing data. A successful save keeps the modal open, refreshes dashboard data, and shows the saved values.

## Billing Editor

- `amount` accepts a whole number greater than or equal to zero.
- A blank amount is stored as `null`.
- Decimal and negative amounts are rejected before sending an update.
- `invoice_number` accepts text.
- A blank or whitespace-only invoice number is stored as `null`.
- Saving updates only `amount` and `invoice_number` on the selected enrollment.
- Existing season, courses, refund state, student profile, and all other enrollment fields remain unchanged.

## Permissions

- Users with `canEditEnrollment` can edit and save both billing fields.
- Other authenticated users see the values in read-only form and do not see an active save action.
- The existing permission model remains the single source of authorization in the UI; database RLS remains responsible for server-side enforcement.

## Components and Data Flow

- `EnrollmentTab` reports both the matched student and clicked enrollment to `App`.
- `App` stores the selected enrollment and renders the dedicated modal.
- The modal owns temporary form state for `amount` and `invoice_number`.
- A focused enrollment service function updates only the two billing columns through Supabase.
- On success, the modal calls the existing dashboard refresh callback so table and modal data stay synchronized.
- Closing the modal clears both the selected student and selected enrollment.

The existing student-selection flow remains available to the student-list page and is not repurposed for enrollment billing.

## Error Handling

- Invalid amounts show a clear validation message and do not send a request.
- Supabase update errors keep the modal open and preserve the entered values for retry.
- Saving is disabled while a request is in progress to prevent duplicate updates.
- Missing student or enrollment data prevents the modal from rendering rather than opening an incomplete editor.

## Testing

- Row clicking passes the exact enrollment and the student matched by `student_id`.
- Rows with missing students do not open an unrelated record.
- The modal renders billing context before student details.
- Authorized users can edit and save amount and invoice number.
- The update payload contains only `amount` and `invoice_number`.
- Zero is valid; blank values become `null`; negative and decimal amounts are rejected.
- Read-only users cannot edit or save.
- Saving refreshes data, keeps the modal open, and prevents duplicate submissions.
- The modal contains neither the student course trend nor the enrollment timeline.
- Existing student-list detail behavior remains covered and unchanged.
