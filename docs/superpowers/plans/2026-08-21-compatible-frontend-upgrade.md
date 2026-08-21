# Compatible Frontend Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `C:\Users\user\Desktop\work` with every database-compatible frontend improvement selected from `work2`, while preserving the target repository's season model and leaving Supabase files and remote data untouched.

**Architecture:** Keep `work` as the source of truth and port behavior units rather than whole files. New UI features consume the existing `students` and `enrollments` snapshots, pure domain helpers normalize and aggregate existing receipt relations, and all mutations continue through the target repository's current services and RPC names.

**Tech Stack:** React 19, Vite 8, Vitest 4, Testing Library, Lucide React, plain CSS, existing Supabase JavaScript client read model

**Spec:** `docs/superpowers/specs/2026-08-21-compatible-frontend-upgrade-design.md`

## Global Constraints

- Do not modify any file under `supabase/`.
- Do not run `supabase link`, `supabase db push`, `supabase db reset`, remote SQL, migrations, or Edge Function deployment.
- Preserve the target `season`, `mobile_phone`, age, student merge, invitation callback, and current receipt interfaces.
- Do not add `period`, `enrollment_forms`, new enrollment-form RPCs, or the `work2` member-profile schema.
- Do not copy `.env.local`, project refs, keys, data exports, or secrets.
- Use TDD for every behavior change: observe the focused test fail for the missing behavior before implementing it.
- Keep the existing 57-file, 409-test target baseline passing.

---

### Task 1: Authenticated Dashboard Error Boundary

**Files:**

- Create: `dashboard/src/components/common/ErrorBoundary.jsx`
- Create: `dashboard/src/components/common/ErrorBoundary.test.jsx`
- Modify: `dashboard/src/App.jsx`
- Test: `dashboard/src/App.test.jsx`

**Interfaces:**

- Consumes: React `children`; optional `onReload(): void` test seam.
- Produces: `ErrorBoundary` class component that catches descendant render errors and renders a Chinese recovery screen.
- Preserves: login and password-setup routing; offline errors remain handled by the existing banner.

- [ ] **Step 1: Write failing ErrorBoundary tests**

```jsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ErrorBoundary from './ErrorBoundary'

function BrokenChild() {
  throw new Error('render exploded')
}

describe('ErrorBoundary', () => {
  it('renders children while no descendant throws', () => {
    render(<ErrorBoundary><p>dashboard ready</p></ErrorBoundary>)
    expect(screen.getByText('dashboard ready')).toBeTruthy()
  })

  it('shows a recovery screen and invokes the reload seam', () => {
    const onReload = vi.fn()
    render(<ErrorBoundary onReload={onReload}><BrokenChild /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('系統發生錯誤')
    fireEvent.click(screen.getByRole('button', { name: '重新整理頁面' }))
    expect(onReload).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npm test -- src/components/common/ErrorBoundary.test.jsx`

Expected: FAIL because `./ErrorBoundary` does not exist.

- [ ] **Step 3: Implement the minimal boundary**

```jsx
import React from 'react'

export default class ErrorBoundary extends React.Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    if (this.props.onReload) this.props.onReload()
    else window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app-error-boundary" role="alert">
        <h1>系統發生錯誤</h1>
        <p>系統遇到無法處理的錯誤，請重新整理頁面再試一次。</p>
        <button type="button" className="btn-primary" onClick={this.handleReload}>重新整理頁面</button>
        <details><summary>錯誤詳情</summary><pre>{String(this.state.error)}</pre></details>
      </main>
    )
  }
}
```

Add focused `.app-error-boundary` styles to `dashboard/src/App.css`, then import and wrap only `<AuthenticatedDashboard />` in `App.jsx`.

- [ ] **Step 4: Add the App integration assertion**

Mock `ErrorBoundary` in `App.test.jsx` with a wrapper carrying `data-testid="authenticated-error-boundary"`, render an authenticated session, and assert the wrapper exists. Set `passwordFlow = 'invite'` and assert it is absent so password setup still mounts before dashboard data.

- [ ] **Step 5: Run focused and App tests**

Run: `npm test -- src/components/common/ErrorBoundary.test.jsx src/App.test.jsx`

Expected: both files PASS.

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/common/ErrorBoundary.jsx dashboard/src/components/common/ErrorBoundary.test.jsx dashboard/src/App.jsx dashboard/src/App.test.jsx dashboard/src/App.css
git commit -m "feat: isolate authenticated dashboard errors"
```

---

### Task 2: Global Keyboard-Accessible Student Search

**Files:**

- Create: `dashboard/src/components/common/QuickSearch.jsx`
- Create: `dashboard/src/components/common/QuickSearch.test.jsx`
- Create: `dashboard/src/components/common/quickSearch.css`
- Modify: `dashboard/src/App.jsx`
- Test: `dashboard/src/App.test.jsx`

**Interfaces:**

- Consumes: `students: Student[]`, `onSelect(student): void`, `onClose(): void`.
- Produces: a modal command palette opened by `Ctrl+K` or `Command+K`.
- Uses target fields: `student_id`, `name`, `mobile_phone`; it does not read `work2.phone`.

- [ ] **Step 1: Write failing QuickSearch behavior tests**

```jsx
const students = [
  { student_id: 101, name: '王小明', mobile_phone: '0912-345-678' },
  { student_id: 'A-202', name: '李小華', mobile_phone: '0988-000-111' },
]

it.each([
  ['101', '王小明'],
  ['小華', '李小華'],
  ['0912', '王小明'],
])('finds target-schema students with %s', (query, expected) => {
  render(<QuickSearch students={students} onSelect={vi.fn()} onClose={vi.fn()} />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: query } })
  expect(screen.getByText(expected)).toBeTruthy()
})

it('supports arrows, Enter, Escape, and restores focus', () => {
  const onSelect = vi.fn()
  const onClose = vi.fn()
  render(<QuickSearch students={students} onSelect={onSelect} onClose={onClose} />)
  const input = screen.getByRole('searchbox')
  fireEvent.change(input, { target: { value: '0' } })
  fireEvent.keyDown(input, { key: 'ArrowDown' })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onSelect).toHaveBeenCalledWith(students[1])
  expect(onClose).toHaveBeenCalledOnce()
})
```

Also test numeric IDs, no-results text, a 10-result cap, dialog semantics, and listener cleanup.

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `npm test -- src/components/common/QuickSearch.test.jsx`

Expected: FAIL because `QuickSearch.jsx` does not exist.

- [ ] **Step 3: Implement schema-compatible filtering and keyboard navigation**

```jsx
const normalizedQuery = query.trim().toLocaleLowerCase('zh-Hant')
const results = normalizedQuery
  ? students.filter(student => [student.student_id, student.name, student.mobile_phone]
      .some(value => String(value ?? '').toLocaleLowerCase('zh-Hant').includes(normalizedQuery)))
      .slice(0, 10)
  : []
```

Use `useModalA11y(panelRef, onClose)` for initial focus, focus trapping, Escape, and restoration. Keep ArrowUp, ArrowDown, and Enter in the search input handler. Render result rows as buttons, use `role="dialog"`, `aria-modal="true"`, an `aria-labelledby` heading, and import `quickSearch.css`.

- [ ] **Step 4: Write failing App shortcut integration tests**

Mock `QuickSearch` in `App.test.jsx`, provide one student through `apiData`, press `Ctrl+K`, assert the palette mounts, select the student, and assert the existing `StudentDetailModal` receives that exact student. Press `Ctrl+K` again and assert it toggles closed. Unmount and verify a later keyboard event does not remount anything.

- [ ] **Step 5: Wire QuickSearch into AuthenticatedDashboard**

```jsx
const [showQuickSearch, setShowQuickSearch] = useState(false)

useEffect(() => {
  const handleKeyDown = event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      setShowQuickSearch(open => !open)
    }
  }
  window.addEventListener('keydown', handleKeyDown)
  return () => window.removeEventListener('keydown', handleKeyDown)
}, [])
```

On selection, call `openStudentDetail(student, 'profile', true)` and close the palette. Mount no shortcut outside the authenticated dashboard.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/components/common/QuickSearch.test.jsx src/App.test.jsx src/hooks/useStudentSelection.test.js`

Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/common/QuickSearch.jsx dashboard/src/components/common/QuickSearch.test.jsx dashboard/src/components/common/quickSearch.css dashboard/src/App.jsx dashboard/src/App.test.jsx
git commit -m "feat: add global student quick search"
```

---

### Task 3: Debounced, Pageable, Multi-Column Student List

**Files:**

- Modify: `dashboard/src/components/students/StudentListTab.jsx`
- Modify: `dashboard/src/components/students/StudentTable.jsx`
- Modify: `dashboard/src/components/students/students.css`
- Test: `dashboard/src/components/students/StudentListTab.test.jsx`

**Interfaces:**

- Consumes existing target student fields, filters, permissions, merge callback, and `onSelectStudent`.
- Produces 300 ms debounced search, page sizes `10 | 20 | 50 | 100`, and sortable `student_id` and `name` columns.
- Preserves `StudentMergeDialog` and the age, gender, and education filters.

- [ ] **Step 1: Add failing fake-timer and paging tests**

```jsx
it('debounces search for 300 ms', () => {
  vi.useFakeTimers()
  render(<StudentListTab students={students} enrollments={[]} onSelectStudent={vi.fn()} />)
  fireEvent.change(screen.getByLabelText(/全文檢索學員資訊/), { target: { value: '王小明' } })
  expect(screen.getByText('李小華')).toBeTruthy()
  act(() => vi.advanceTimersByTime(300))
  expect(screen.queryByText('李小華')).toBeNull()
  vi.useRealTimers()
})

it('changes page size and resets to page one', () => {
  render(<StudentListTab students={makeStudents(25)} enrollments={[]} onSelectStudent={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: '跳至最尾頁' }))
  fireEvent.change(screen.getByLabelText('每頁筆數'), { target: { value: '20' } })
  expect(screen.getByText(/顯示第 1 至 20 筆/)).toBeTruthy()
})
```

Add assertions that clicking 姓名 sorts ascending then descending, ID remains numeric-aware, filtering clamps an out-of-range page, and the admin merge button still opens `StudentMergeDialog`.

- [ ] **Step 2: Run the focused test and observe the behavior failures**

Run: `npm test -- src/components/students/StudentListTab.test.jsx`

Expected: FAIL on immediate filtering, absent page-size control, and absent name sorting.

- [ ] **Step 3: Split immediate input from committed search state**

```jsx
const [studentSearchInput, setStudentSearchInput] = useState('')
const [studentSearch, setStudentSearch] = useState('')

useEffect(() => {
  const timer = setTimeout(() => {
    setStudentSearch(studentSearchInput)
    setStudentPage(1)
  }, 300)
  return () => clearTimeout(timer)
}, [studentSearchInput])
```

Retain the current target search fields and age/education matching. Do not replace them with the `work2` member schema.

- [ ] **Step 4: Add page-size and sorting state**

Use `sortField`, `sortOrder`, and `itemsPerPage`. `student_id` uses `localeCompare(..., { numeric: true })`; `name` uses `localeCompare(..., 'zh-Hant')`. A new field starts ascending; clicking the active field toggles direction.

Clamp the page after result or page-size changes:

```jsx
useEffect(() => {
  setStudentPage(page => Math.min(page, totalStudentPages))
}, [totalStudentPages])
```

- [ ] **Step 5: Render accessible sortable headers and page-size control**

Use real header buttons with `aria-sort` on ID and 姓名. Add:

```jsx
<label className="page-size-selector">
  每頁筆數
  <select aria-label="每頁筆數" value={itemsPerPage} onChange={event => onPageSizeChange(Number(event.target.value))}>
    {[10, 20, 50, 100].map(size => <option key={size} value={size}>{size}</option>)}
  </select>
</label>
```

Keep the row history button and merge modal wiring unchanged.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- src/components/students/StudentListTab.test.jsx src/components/students/StudentDetailComponents.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/students/StudentListTab.jsx dashboard/src/components/students/StudentTable.jsx dashboard/src/components/students/StudentListTab.test.jsx dashboard/src/components/students/students.css
git commit -m "feat: improve student list navigation"
```

---

### Task 4: Complete Receipt Normalization and Receipt-Number History Search

**Files:**

- Modify: `dashboard/src/domain/enrollmentBilling.js`
- Test: `dashboard/src/domain/enrollmentBilling.test.js`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx`
- Test: `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`

**Interfaces:**

- Consumes current nested `courses[].billing_receipt_courses[].billing_receipts` and legacy enrollment billing fields.
- Produces deduplicated `courseDetails`, `billingReceipts`, and receipt-number search.
- Preserves `season`, `refunded`, normal/refunded filters, and current history selection.

- [ ] **Step 1: Add failing normalization tests**

```js
it('keeps every linked receipt while exposing the first receipt on a course detail', () => {
  const result = normalizeEnrollmentBilling([{
    course_id: 1,
    course_name: '瑜珈',
    billing_receipt_courses: [
      { billing_receipts: { receipt_id: 10, amount: 500, invoice_number: 'R-10' } },
      { billing_receipts: { receipt_id: 11, amount: 700, invoice_number: 'R-11' } },
    ],
  }])
  expect(result.billingReceipts.map(receipt => receipt.receiptId)).toEqual([10, 11])
  expect(result.courseDetails[0].receipt.receiptId).toBe(10)
})

it('deduplicates one grouped receipt linked to multiple courses', () => {
  const result = normalizeEnrollmentBilling(twoCoursesSharingReceipt(20))
  expect(result.billingReceipts).toHaveLength(1)
  expect(result.billingReceipts[0].courses).toHaveLength(2)
})
```

- [ ] **Step 2: Run the domain test and verify it fails on first-link-only behavior**

Run: `npm test -- src/domain/enrollmentBilling.test.js`

Expected: FAIL because only the first link is currently normalized.

- [ ] **Step 3: Normalize relation values consistently**

```js
function asArray(value) {
  if (Array.isArray(value)) return value
  return value == null ? [] : [value]
}

for (const link of asArray(course.billing_receipt_courses)) {
  const receipt = firstReceipt(link?.billing_receipts)
  if (!receipt) continue
  // Add or merge by receipt_id; add each course at most once.
}
```

Keep `summarizeEnrollmentBilling` free of `forms` and `period` logic. Its legacy fallback remains unchanged.

- [ ] **Step 4: Add failing history-search and copy tests**

Use one current `billingReceipts` enrollment and one legacy `invoice_number` enrollment. Search case-insensitively for each receipt and assert only its row remains. Assert headers equal:

```js
['姓名', '季別', '課程', '收費狀況', '金額', '收據 No.']
```

Assert labels and placeholder mention `收據 No.` while `篩選季別` remains present and `部分退費` remains absent.

- [ ] **Step 5: Run EnrollmentTab tests and observe the missing search behavior**

Run: `npm test -- src/components/enrollment/EnrollmentTab.test.jsx`

Expected: FAIL because receipt numbers are not searched and old labels remain.

- [ ] **Step 6: Extend the existing filter without changing schema fields**

```jsx
const billing = summarizeEnrollmentBilling(enrollment)
const matchesSearch =
  String(enrollment.student_name ?? '').toLowerCase().includes(normalizedSearch) ||
  (enrollment.courses ?? []).some(course => String(course).toLowerCase().includes(normalizedSearch)) ||
  billing.invoiceNumbers.some(number => String(number).toLowerCase().includes(normalizedSearch))
```

Update only user-facing billing labels. Keep `historySeasonFilter`, `enrollment.season`, `compareSeasons`, and the two current refund options.

- [ ] **Step 7: Run focused tests**

Run: `npm test -- src/domain/enrollmentBilling.test.js src/components/enrollment/EnrollmentTab.test.jsx src/services/dashboardDataService.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add dashboard/src/domain/enrollmentBilling.js dashboard/src/domain/enrollmentBilling.test.js dashboard/src/components/enrollment/EnrollmentTab.jsx dashboard/src/components/enrollment/EnrollmentTab.test.jsx
git commit -m "feat: search and aggregate enrollment receipts"
```

---

### Task 5: Revenue KPI on the Existing Season Model

**Files:**

- Modify: `dashboard/src/hooks/useStats.js`
- Test: `dashboard/src/hooks/useStats.test.js`
- Modify: `dashboard/src/components/overview/KpiCards.jsx`
- Test: `dashboard/src/components/overview/KpiCards.test.jsx`

**Interfaces:**

- Consumes: `summarizeEnrollmentBilling(enrollment)` from Task 4 and current `season` groups.
- Produces: `stats.totalRevenue` and `seasonStats[].revenue`.
- Rule: include only non-refunded enrollments; count a deduplicated grouped receipt once.

- [ ] **Step 1: Add failing revenue aggregation tests**

```js
it('aggregates current receipt and legacy revenue while excluding refunds', () => {
  const enrollments = [
    { student_id: '1', season: 'Season A', refunded: false, courses: ['A'], billingReceipts: [{ receiptId: 1, amount: 1000 }] },
    { student_id: '2', season: 'Season A', refunded: false, courses: ['B'], amount: 500, invoice_number: 'OLD' },
    { student_id: '3', season: 'Season B', refunded: true, courses: ['C'], billingReceipts: [{ receiptId: 2, amount: 900 }] },
  ]
  const { result } = renderHook(() => useStats(students, enrollments))
  expect(result.current.totalRevenue).toBe(1500)
  expect(result.current.seasonStats.find(item => item.season === 'Season A').revenue).toBe(1500)
  expect(result.current.seasonStats.find(item => item.season === 'Season B').revenue).toBe(0)
})
```

Also cover a receipt shared by two courses through the normalized `billingReceipts` array and an enrollment with unknown amount.

- [ ] **Step 2: Run the hook test and verify the missing-property failure**

Run: `npm test -- src/hooks/useStats.test.js`

Expected: FAIL because `totalRevenue` and group `revenue` are absent.

- [ ] **Step 3: Add revenue to the existing season aggregation**

Import `summarizeEnrollmentBilling`. Initialize `totalRevenue = 0` and `seasonGroups[season].revenue = 0`. For each non-refunded enrollment:

```js
const amount = summarizeEnrollmentBilling(enrollment).amount
if (amount != null) {
  totalRevenue += amount
  group.revenue += amount
}
```

Return zero revenue in the empty-state object. Do not rename season keys or restore any `period` source code.

- [ ] **Step 4: Add failing KPI rendering tests**

Render `KpiCards` with `totalRevenue: 123456`, current revenue `45678`, and previous revenue `40000`. Assert `總營收`, locale-formatted values, `元`, and the positive delta are displayed.

- [ ] **Step 5: Render the fifth KPI card**

```jsx
[DollarSign, 'green', '總營收', (stats.totalRevenue ?? 0).toLocaleString(), '元',
  currentSeasonStats && <>當季營收：{(currentSeasonStats.revenue ?? 0).toLocaleString()} 元 {delta(currentSeasonStats.revenue, previousSeasonStats?.revenue)}</>]
```

Keep the existing `.kpi-grid { grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); }`, which already wraps five cards without a new layout rule.

- [ ] **Step 6: Run focused overview tests**

Run: `npm test -- src/hooks/useStats.test.js src/hooks/useStats.season.test.js src/components/overview/KpiCards.test.jsx src/components/overview/OverviewTab.test.jsx`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/hooks/useStats.js dashboard/src/hooks/useStats.test.js dashboard/src/components/overview/KpiCards.jsx dashboard/src/components/overview/KpiCards.test.jsx
git commit -m "feat: add season-compatible revenue metrics"
```

---

### Task 6: Modal Accessibility and Friendly Delete Constraints

**Files:**

- Create: `dashboard/src/hooks/useModalA11y.test.jsx`
- Modify: `dashboard/src/hooks/useModalA11y.js`
- Create: `dashboard/src/components/common/ConfirmDialog.test.jsx`
- Modify: `dashboard/src/components/common/ConfirmDialog.jsx`
- Modify: `dashboard/src/components/students/AddStudentModal.jsx`
- Test: `dashboard/src/components/students/AddStudentModal.test.jsx`
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Test: `dashboard/src/components/students/StudentDetailComponents.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`
- Test: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx`
- Modify: `dashboard/src/components/sync/ExportOptionsDialog.jsx`
- Test: `dashboard/src/components/sync/ExportOptionsDialog.test.jsx`
- Modify: `dashboard/src/components/sync/ImportPreviewDialog.jsx`
- Test: `dashboard/src/components/sync/ImportPreviewDialog.test.jsx`
- Modify: `dashboard/src/services/studentService.js`
- Test: `dashboard/src/services/studentService.test.js`

**Interfaces:**

- Consumes: `modalRef`, `onClose`, current ConfirmDialog callbacks, Supabase errors.
- Produces: focus trap, Escape close, focus restoration, accessible confirm-dialog semantics, and a stable Chinese message for PostgreSQL code `23503`.
- Preserves: destructive confirmation callbacks and every non-`23503` error object.

- [ ] **Step 1: Add failing hook tests**

Cover first-focus, Tab from last to first, Shift+Tab from first to last, Escape exactly once, focus restoration after unmount, and a modal with no focusable controls.

```jsx
it('restores focus to the opener after unmount', () => {
  render(<Harness />)
  const opener = screen.getByRole('button', { name: '開啟' })
  opener.focus()
  fireEvent.click(opener)
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
  expect(document.activeElement).toBe(opener)
})
```

- [ ] **Step 2: Run hook tests and observe missing edge-case coverage**

Run: `npm test -- src/hooks/useModalA11y.test.jsx`

Expected: at least the no-focusable or outside-focus wrapping case FAILS against the current implementation.

- [ ] **Step 3: Harden the hook**

Query focusable elements on each Tab event, prevent Tab when none exist, and wrap when focus is outside the modal as well as at either edge. Keep listener registration on the modal and restore the original active element in cleanup.

- [ ] **Step 4: Add failing ConfirmDialog semantics tests**

Assert `role="dialog"`, `aria-modal="true"`, title linkage, Escape calls `onCancel`, the cancel button receives initial focus, clicking the overlay does not invoke either callback, and confirm invokes only `onConfirm`. The current component has `onClick={onCancel}` on the overlay, so the backdrop assertion must fail before implementation.

- [ ] **Step 5: Apply the shared hook to ConfirmDialog**

```jsx
const modalRef = useRef(null)
useModalA11y(modalRef, onCancel)

<div className="modal-overlay-center">
  <div ref={modalRef} role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title" className="form-modal-content">
    <h3 id="confirm-dialog-title">{title}</h3>
```

Remove the existing `onClick={onCancel}` from the overlay; do not replace it with another overlay click handler.

- [ ] **Step 6: Add failing backdrop-dismissal tests for data-entry dialogs**

For each existing component test, render the dialog, click only its outer overlay, and assert the close/cancel callback is unchanged:

```jsx
fireEvent.click(container.querySelector('.modal-overlay, .modal-overlay-center'))
expect(onClose).not.toHaveBeenCalled()
```

Cover `AddStudentModal`, both `StudentDetailModal` render branches, `EnrollmentBillingDetailModal`, `ExportOptionsDialog`, and `ImportPreviewDialog`. Preserve explicit close, cancel, Escape, and confirmation-button behavior.

- [ ] **Step 7: Remove backdrop close handlers without changing inner actions**

Remove only the outer-overlay `onClick` props from those five dialog components. Keep inner `stopPropagation` harmlessly where already present, keep `requestClose` attached to explicit close actions, and keep `useUnsavedChangesGuard` behavior unchanged.

- [ ] **Step 8: Add failing student deletion error tests**

```js
it('maps foreign-key deletion failures to a stable Chinese message', async () => {
  const error = { code: '23503', message: 'violates foreign key constraint' }
  await expect(deleteStudent(deleteClient(error), '1'))
    .rejects.toThrow('無法刪除此學員：尚有關聯的報名紀錄或收據，請先清理後再試。')
})

it('preserves unrelated deletion errors', async () => {
  const error = new Error('delete denied')
  await expect(deleteStudent(deleteClient(error), '1')).rejects.toBe(error)
})
```

- [ ] **Step 9: Implement only the `23503` mapping**

```js
if (error?.code === '23503') {
  throw new Error('無法刪除此學員：尚有關聯的報名紀錄或收據，請先清理後再試。')
}
throw error
```

- [ ] **Step 10: Run focused tests**

Run: `npm test -- src/hooks/useModalA11y.test.jsx src/components/common/ConfirmDialog.test.jsx src/components/students/AddStudentModal.test.jsx src/components/students/StudentDetailComponents.test.jsx src/components/enrollment/EnrollmentBillingDetailModal.test.jsx src/components/sync/ExportOptionsDialog.test.jsx src/components/sync/ImportPreviewDialog.test.jsx src/services/studentService.test.js`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add dashboard/src/hooks/useModalA11y.js dashboard/src/hooks/useModalA11y.test.jsx dashboard/src/components/common/ConfirmDialog.jsx dashboard/src/components/common/ConfirmDialog.test.jsx dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/AddStudentModal.test.jsx dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx dashboard/src/components/sync/ExportOptionsDialog.jsx dashboard/src/components/sync/ExportOptionsDialog.test.jsx dashboard/src/components/sync/ImportPreviewDialog.jsx dashboard/src/components/sync/ImportPreviewDialog.test.jsx dashboard/src/services/studentService.js dashboard/src/services/studentService.test.js
git commit -m "fix: harden dialogs and deletion feedback"
```

---

### Task 7: Compatible Light/Dark Visual Polish

**Files:**

- Modify: `dashboard/src/components/admin/admin.css`
- Modify: `dashboard/src/components/enrollment/enrollment.css`
- Test: `dashboard/src/components/admin/AdminAccountPage.test.jsx`
- Test: `dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx`

**Interfaces:**

- Consumes: existing CSS variables and existing DOM class names only.
- Produces: solid card surfaces, readable light-theme status text, and visible timeline hover/focus states.
- Preserves: markup, data flow, role behavior, and all theme toggle semantics.

- [ ] **Step 1: Run the existing structural tests as a pre-change baseline**

Run: `npm test -- src/components/admin/AdminAccountPage.test.jsx src/components/enrollment/EnrollmentTimeline.test.jsx src/hooks/useTheme.test.js`

Expected: PASS. Record that `.admin-summary-card`, role/status badge variants, `.timeline-card`, `.timeline-card-select`, and breakdown tags are exercised by rendered components.

- [ ] **Step 2: Apply only selectors that exist in the target DOM**

Use existing variables instead of hard-coded dark backgrounds:

```css
.admin-summary-card,
.admin-audit-list {
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
}

.timeline-card {
  background: var(--bg-card);
  box-shadow: var(--shadow-sm);
}

.timeline-card:hover {
  background: var(--bg-card-hover);
  border-color: var(--color-accent);
  box-shadow: var(--shadow-md);
}
```

Add light-theme overrides for admin role/status badges and prepaid/formal breakdown tags. Reuse existing `--badge-*`, `--input-bg`, `--table-footer-bg`, `--bg-card-hover`, and `--shadow-*` variables. Do not rename classes or add `work2` form selectors.

```css
:root[data-theme="light"] .admin-role-select--admin { color: #b91c1c; background: rgba(239, 68, 68, 0.08); }
:root[data-theme="light"] .admin-role-select--editor { color: #b45309; background: rgba(245, 158, 11, 0.08); }
:root[data-theme="light"] .admin-role-select--viewer { color: #1d4ed8; background: rgba(59, 130, 246, 0.08); }
:root[data-theme="light"] .admin-status-badge.invited { color: #b45309; background: rgba(245, 158, 11, 0.1); }

.breakdown-tag { background: var(--input-bg); }
:root[data-theme="light"] .breakdown-tag.prepaid { color: #1d4ed8; background: rgba(59, 130, 246, 0.1); }
:root[data-theme="light"] .breakdown-tag.formal { color: #047857; background: rgba(16, 185, 129, 0.1); }
```

- [ ] **Step 3: Run structural tests and production build**

Run: `npm test -- src/components/admin/AdminAccountPage.test.jsx src/components/enrollment/EnrollmentTimeline.test.jsx src/hooks/useTheme.test.js`

Run: `npm run build`

Expected: tests PASS and Vite build succeeds.

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/admin/admin.css dashboard/src/components/enrollment/enrollment.css
git commit -m "style: align admin and timeline theme surfaces"
```

---

### Task 8: Full Regression and Database-Scope Guard

**Files:**

- Modify only if verification reveals an in-scope frontend defect: the smallest affected `dashboard/` source and its test.
- Do not modify: `supabase/**`, `.env*`, exported data, secrets, or private data files.

**Interfaces:**

- Consumes all deliverables from Tasks 1–7.
- Produces final evidence that the target frontend is healthy and the database scope is untouched.

- [ ] **Step 1: Confirm the changed-path boundary**

Run: `git status --short`

Run: `git diff --name-only HEAD~7..HEAD`

Expected: implementation paths are under `dashboard/` plus the already approved `docs/superpowers/` files; there are no paths under `supabase/`, no `.env` files, and no data exports.

- [ ] **Step 2: Run the complete frontend test suite**

Run: `npm test -- --reporter=dot`

Expected: all test files and tests PASS; the count is greater than the 57-file, 409-test baseline because new tests were added.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code 0 with no lint errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a Vite production bundle under ignored `dashboard/dist/`.

- [ ] **Step 5: Inspect the final diff for accidental source overwrites**

Run: `git diff --check HEAD~7..HEAD`

Run: `git diff --stat HEAD~7..HEAD`

Expected: no whitespace errors; target-only student merge, season overview, invite callback, and current data interfaces remain present.

- [ ] **Step 6: Record final verification in the handoff**

Report exact test, lint, and build results; list the commits; explicitly state that no database command ran and `supabase/` is unchanged. Do not create a verification-only commit unless a frontend defect required a tested fix.

---

## Completion Criteria

- The authenticated dashboard has a tested recovery boundary.
- `Ctrl+K` and `Command+K` open a tested target-schema student search.
- The student list supports debounced search, page sizes, and ID/name sorting while retaining merge and all legacy filters.
- Enrollment history searches current and legacy receipt numbers without changing season or refund data fields.
- Receipt normalization handles multiple relation rows and shared grouped receipts without double counting.
- Total and current-season revenue are visible and exclude refunded enrollments.
- Confirm dialogs and the shared modal hook have focus, Escape, and restoration coverage.
- Student delete foreign-key errors have a stable Chinese message while unrelated errors are preserved.
- Compatible admin and timeline theme surfaces remain readable in light and dark modes.
- Full tests, lint, and build pass.
- No `supabase/`, environment, remote database, or private-data change occurs.
