# Compact Enrollment History with Billing Fields

## Goal

Make the historical enrollment page less detailed than the student list while showing the information staff need for each enrollment: student name, season, courses, refund status, amount, and invoice number.

## Scope

- Add two nullable fields to `public.enrollments`:
  - `amount integer` with a non-negative value constraint.
  - `invoice_number text`.
- Existing and future null values are valid.
- The fields are maintained directly through the Supabase backend.
- The dashboard only reads and displays these fields.
- Do not add either field to enrollment creation or editing forms.
- Do not change CSV/Excel import or export behavior.

## History Page

Keep one row per enrollment. When an enrollment contains multiple courses, show all course names in the existing course-tag area.

The table column order will be:

1. 姓名
2. 季別
3. 課程
4. 退費狀況
5. 金額
6. 發票編號

Remove the student ID and new/returning columns. Remove the new/returning filter.

Keep:

- Name and course search.
- Season filtering.
- Refund-status filtering.
- Pagination.
- Row selection that opens the matching student record.

## Display Rules

- A numeric amount is rendered as `NT$ ` followed by the stored integer, without thousands separators. For example, `1200` renders as `NT$ 1200`.
- A null or missing amount renders as `--`.
- A null or empty invoice number renders as `--`.
- Refund status keeps the existing `已退費` and `正常` badges.

## Data Flow

The existing dashboard query selects all enrollment columns, so the new fields will flow through `dashboardDataService` without a new request or write path. `EnrollmentTab` will read `amount` and `invoice_number` from each enrollment object.

Existing rows remain compatible because both new fields are nullable.

## Error and Edge Cases

- `amount = 0` is a valid value and displays as `NT$ 0`.
- Negative amounts are rejected by the database constraint.
- Blank invoice numbers display as `--`.
- Missing billing fields in test fixtures and legacy data do not break rendering.
- The empty-table row spans all six columns.

## Testing

- Assert the exact six-column order.
- Assert that student ID and new/returning values are not table columns.
- Assert amount rendering without thousands separators, including zero and null.
- Assert invoice-number rendering and the null/empty fallback.
- Preserve coverage for selecting a student by `student_id`, empty results, filtering, and first/last-page navigation.
- Run the dashboard test suite and production build after implementation.
