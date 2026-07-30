# Enrollment refund action group design

## Goal

Keep the refund-status badge visually adjacent to the refund action in the billing-detail modal, while retaining the receipt heading on the left.

## Layout

`EnrollmentBillingDetailModal` will wrap the existing badge and the editor-only refund button in an `enrollment-billing-actions` container. The heading remains a sibling on the left. The new container uses flexbox with centered alignment and a small gap, so the badge and button stay together regardless of the parent heading's `space-between` layout.

For viewers, the container renders with the badge only. For editors and admins, it renders both the badge and the appropriate action button.

## Scope and behavior

This is a presentation-only change. It does not modify permission checks, refund persistence, button labels, disabled behavior, success/error messages, or refresh behavior.

## Testing

Extend the existing modal test to assert that the normal-status badge and refund button share the new action-group container for editors, and that a viewer's action group contains no button. Existing refund interaction tests remain the regression coverage for behavior.
