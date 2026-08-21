# Task 6 Report: Modal Accessibility and Friendly Delete Constraints

## Scope

Implemented the approved Task 6 brief without touching `supabase/`, migrations, SQL/RPC, configuration, environment files, or the database model.

## TDD evidence

- Baseline before changes: `npm test` — 59 test files, 433 tests passed.
- RED: added behavior tests and ran the focused command from the brief. After test cleanup and portal-query isolation, it produced the intended 10 failures:
  - focus trapping when focus is outside the modal and when no controls are focusable;
  - ConfirmDialog dialog semantics and non-dismissible backdrop;
  - backdrop clicks for AddStudentModal, both StudentDetailModal branches, EnrollmentBillingDetailModal, ExportOptionsDialog, and ImportPreviewDialog;
  - PostgreSQL `23503` deletion feedback.
- An additional RED test exposed a lifecycle edge case: a ConfirmDialog initially rendered closed did not attach its keyboard listener when later opened. It failed with `onCancel` called zero times after Escape.
- GREEN focused verification: `npm test -- src/hooks/useModalA11y.test.jsx src/components/common/ConfirmDialog.test.jsx src/components/students/AddStudentModal.test.jsx src/components/students/StudentDetailComponents.test.jsx src/components/enrollment/EnrollmentBillingDetailModal.test.jsx src/components/sync/ExportOptionsDialog.test.jsx src/components/sync/ImportPreviewDialog.test.jsx src/services/studentService.test.js` — 8 test files, 78 tests passed.

## Implementation decisions

- `useModalA11y` re-queries focusable elements on each Tab, stops Tab when none exist, and redirects out-of-modal focus to the first/last control according to direction. Escape and opener-focus restoration remain intact.
- ConfirmDialog now uses a mounted-only inner component so `useModalA11y` activates correctly after closed-to-open transitions. It has `role="dialog"`, `aria-modal="true"`, and a title relationship; the first control remains Cancel. Its overlay has no click handler.
- Removed only outer-overlay close handlers from the five dialogs named in the brief. Explicit controls, Escape flows, and StudentDetailModal's unsaved-change guard remain in place.
- Left `AddEnrollModal` unchanged: it is outside the authoritative target list.
- `deleteStudent` maps only `error.code === '23503'` to `無法刪除此學員：尚有關聯的報名紀錄或收據，請先清理後再試。`; every other error is thrown as the original object.

## Final verification

- `npm test` — 62 test files, 450 tests passed.
- `npm run lint` — exit 0; four pre-existing Fast Refresh warnings in `AuthContext.jsx` and `components/ui/button.jsx` remain. No Task 6 lint warnings.
- `npm run build` — exit 0. The existing Vite large-chunk advisory remains non-blocking.
- `git diff --check` — no whitespace errors.

## Commit

Base commit before Task 6: `d59a1457ba2ec17efdfce2eaa7860fbf0fbbb956`.
Task implementation commit SHA: `2568922` (`fix: harden dialogs and deletion feedback`).
