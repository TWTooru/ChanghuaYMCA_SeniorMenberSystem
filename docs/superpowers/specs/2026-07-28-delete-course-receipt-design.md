# Delete Course Receipt Design

## Goal

Allow editors and administrators to permanently delete an existing per-course
receipt. Once the receipt row is deleted, the enrolled course is no longer
receipt-locked and may be removed from the enrollment.

## Scope

- Add permanent deletion for `public.course_receipts`.
- Show a delete action beside each existing receipt for editor/admin users.
- Require an explicit, destructive confirmation before deletion.
- Refresh enrollment data after deletion so receipt and course-lock state are
  authoritative.
- Keep viewers read-only.

Out of scope:

- Soft deletion, void status, audit history, or receipt restoration.
- Deleting an enrolled course as part of receipt deletion.
- Bulk receipt deletion.

## Data and Permissions

Add a DELETE RLS policy on `public.course_receipts` for authenticated users
whose `current_app_role()` is `editor` or `admin`. Existing SELECT, INSERT, and
UPDATE policies remain unchanged.

Deleting a receipt does not delete its `courses` row. The existing enrollment
update RPC determines course locking by joining `courses` to
`course_receipts`; therefore the course becomes removable immediately after
the receipt row is deleted.

## Frontend Service

Add:

```js
deleteCourseReceipt(client, receiptId)
```

The service deletes from `course_receipts` using `receipt_id`, reports
Supabase errors to the caller, and rejects invalid identifiers before sending
a request.

## User Interface

Each existing receipt row shows `編輯` and `刪除` for editor/admin users.
Viewer users see neither mutation action.

Clicking `刪除` opens a confirmation:

> 確定刪除此課程的收據？金額與發票編號將無法復原。

Cancel performs no write. Confirm disables receipt mutation controls, calls
`deleteCourseReceipt`, refreshes enrollment data, clears any editor for that
receipt, and keeps the billing modal open. The refreshed course then appears
under `新增收據` and is no longer locked in enrollment editing.

If deletion fails, the receipt remains visible, the modal stays open, and an
inline error is displayed. Duplicate clicks while deletion is pending issue
only one request.

## Testing

- Service tests cover successful deletion, invalid IDs, and Supabase errors.
- Modal tests cover confirmation, cancellation, pending deduplication,
  refresh-on-success, failure preservation, and viewer permissions.
- Enrollment edit behavior remains covered by the existing rule that only
  courses with a current receipt row are locked.
- Run focused tests, the full dashboard suite, lint, and a production build.

## Rollout

1. Apply the new DELETE-policy migration to Supabase.
2. Deploy the newly built `dashboard/dist`.
3. Smoke-test delete as editor/admin and verify the course can then be removed.
4. Verify viewer users have no delete action.
