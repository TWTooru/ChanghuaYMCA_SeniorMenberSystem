# Table Footer First/Last Page Buttons

## Goal

Add first-page and last-page controls to both existing table footers:

- Student list
- Enrollment history

The controls must integrate into the current pagination row and preserve each table's existing page-number behavior.

## Interaction Design

Each pagination group will use this order:

1. First page
2. Previous page
3. Existing page numbers, where present
4. Next page
5. Last page

The first-page and last-page controls will use Lucide's `ChevronsLeft` and `ChevronsRight` icons so they remain visually consistent with the existing `ChevronLeft` and `ChevronRight` controls.

Icon-only buttons will include Chinese accessible names and tooltips:

- `跳至最前頁`
- `跳至最尾頁`

On the first page, both first-page and previous-page controls are disabled. On the last page, both next-page and last-page controls are disabled.

## Component Changes

### Student table

`StudentTable` will add controls that call the existing `onPageChange` callback with page `1` or `totalStudentPages`. No pagination ownership or data flow will change.

### Enrollment history

`EnrollmentTab` will add controls that set `historyPage` to `1` or `totalHistoryPages`. Filtering will continue to reset the current page to `1`.

### Styling

The new controls will reuse `btn-secondary` and the existing pagination flex layout. No new CSS is required unless verification finds a concrete responsive layout issue.

## Data Flow and Boundaries

The controls only update existing local page state through the same pathways as the current controls. They do not fetch data, mutate records, or change page-size calculations.

All navigation targets are already bounded:

- First page is always `1`.
- Total page counts fall back to `1` for empty result sets.

## Verification

Component tests will verify for both tables that:

- The new buttons are discoverable by their accessible names.
- First-page controls are disabled initially.
- Navigating to the last page shows the expected final-page rows.
- Last-page controls become disabled on the last page.
- Returning to the first page restores the first-page rows and disabled state.

The dashboard test suite, lint command, and production build will be run after implementation.
