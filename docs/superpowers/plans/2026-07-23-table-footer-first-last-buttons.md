# Table Footer First/Last Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible first-page and last-page icon controls to both existing table pagination footers.

**Architecture:** Reuse each component's existing page state and pagination callback. Add Lucide double-chevron icons inside the current pagination flex rows, with boundary-aware disabled states and no new shared abstraction or CSS.

**Tech Stack:** React 19, Lucide React, Vitest, Testing Library, Vite

## Global Constraints

- Apply the feature to both the student list and enrollment history.
- Keep the controls inside the existing pagination row.
- Use the order: first, previous, existing page numbers where present, next, last.
- Use `ChevronsLeft` and `ChevronsRight`.
- Use the accessible names and tooltips `跳至最前頁` and `跳至最尾頁`.
- Disable first and previous on page `1`; disable next and last on the final page.
- Reuse `btn-secondary` and `.pagination-buttons`; add no CSS unless verification exposes a concrete layout defect.

---

## File Structure

- Modify `dashboard/src/components/students/StudentTable.jsx`: render first/last controls through the existing `onPageChange` interface.
- Modify `dashboard/src/components/students/StudentListTab.test.jsx`: verify student pagination endpoints and accessible button states.
- Modify `dashboard/src/components/enrollment/EnrollmentTab.jsx`: render first/last controls through the existing `historyPage` state.
- Modify `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`: verify enrollment pagination endpoints and accessible button states.
- No CSS or new component files are required.

### Task 1: Student List First/Last Navigation

**Files:**

- Modify: `dashboard/src/components/students/StudentTable.jsx:1-2,114-176`
- Test: `dashboard/src/components/students/StudentListTab.test.jsx:1-40`

**Interfaces:**

- Consumes: `studentPage: number`, `totalStudentPages: number`, `onPageChange(page: number): void`
- Produces: buttons named `跳至最前頁` and `跳至最尾頁`

- [ ] **Step 1: Write the failing student pagination test**

Append this test inside the existing `describe` block in `StudentListTab.test.jsx`:

```jsx
  it('jumps directly between the first and last student pages', () => {
    const students = Array.from({ length: 21 }, (_, index) => ({
      student_id: `S-${String(index + 1).padStart(3, '0')}`,
      name: `Student ${index + 1}`,
      gender: 'Female'
    }))

    render(
      <StudentListTab
        students={students}
        enrollments={[]}
        onSelectStudent={vi.fn()}
        onShowAddStudent={vi.fn()}
      />
    )

    const firstPageButton = screen.getByRole('button', { name: '跳至最前頁' })
    const lastPageButton = screen.getByRole('button', { name: '跳至最尾頁' })

    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)

    fireEvent.click(lastPageButton)

    expect(screen.getByText('Student 21')).not.toBeNull()
    expect(screen.queryByText('Student 1')).toBeNull()
    expect(firstPageButton.disabled).toBe(false)
    expect(lastPageButton.disabled).toBe(true)

    fireEvent.click(firstPageButton)

    expect(screen.getByText('Student 1')).not.toBeNull()
    expect(screen.queryByText('Student 21')).toBeNull()
    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- --run src/components/students/StudentListTab.test.jsx
```

Working directory: `dashboard`

Expected: FAIL because no button with accessible name `跳至最前頁` exists.

- [ ] **Step 3: Add the student first/last controls**

Change the Lucide import in `StudentTable.jsx` to:

```jsx
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from 'lucide-react'
```

Insert this button immediately before the existing `btn-student-prev` button:

```jsx
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(1)}
            disabled={studentPage === 1}
            id="btn-student-first"
            aria-label="跳至最前頁"
            title="跳至最前頁"
          >
            <ChevronsLeft size={16} style={{ display: 'block' }} />
          </button>
```

Insert this button immediately after the existing `btn-student-next` button:

```jsx
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onPageChange(totalStudentPages)}
            disabled={studentPage === totalStudentPages}
            id="btn-student-last"
            aria-label="跳至最尾頁"
            title="跳至最尾頁"
          >
            <ChevronsRight size={16} style={{ display: 'block' }} />
          </button>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- --run src/components/students/StudentListTab.test.jsx
```

Working directory: `dashboard`

Expected: all `StudentListTab.test.jsx` tests PASS.

- [ ] **Step 5: Commit the student pagination change**

```powershell
git add -- dashboard/src/components/students/StudentTable.jsx dashboard/src/components/students/StudentListTab.test.jsx
git commit -m "feat(students): add first and last page controls"
```

### Task 2: Enrollment History First/Last Navigation

**Files:**

- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx:1-2,184-206`
- Test: `dashboard/src/components/enrollment/EnrollmentTab.test.jsx:1-117`

**Interfaces:**

- Consumes: `historyPage: number`, `totalHistoryPages: number`, `setHistoryPage(page: number): void`
- Produces: buttons named `跳至最前頁` and `跳至最尾頁`

- [ ] **Step 1: Write the failing enrollment pagination test**

Append this test inside the existing `describe` block in `EnrollmentTab.test.jsx`:

```jsx
  it('jumps directly between the first and last enrollment pages', () => {
    const enrollments = Array.from({ length: 21 }, (_, index) => ({
      enrollment_id: index + 1,
      student_id: String(index + 1),
      student_name: `Enrollment ${index + 1}`,
      season: 'Season A',
      reg_type: 'New',
      pre_test: '',
      post_test: '',
      refunded: false,
      courses: [`Course ${index + 1}`]
    }))

    render(
      <EnrollmentTab
        students={[]}
        enrollments={enrollments}
        onSelectStudent={vi.fn()}
      />
    )

    const firstPageButton = screen.getByRole('button', { name: '跳至最前頁' })
    const lastPageButton = screen.getByRole('button', { name: '跳至最尾頁' })

    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)

    fireEvent.click(lastPageButton)

    expect(screen.getByText('Enrollment 21')).not.toBeNull()
    expect(screen.queryByText('Enrollment 1')).toBeNull()
    expect(firstPageButton.disabled).toBe(false)
    expect(lastPageButton.disabled).toBe(true)

    fireEvent.click(firstPageButton)

    expect(screen.getByText('Enrollment 1')).not.toBeNull()
    expect(screen.queryByText('Enrollment 21')).toBeNull()
    expect(firstPageButton.disabled).toBe(true)
    expect(lastPageButton.disabled).toBe(false)
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- --run src/components/enrollment/EnrollmentTab.test.jsx
```

Working directory: `dashboard`

Expected: FAIL because no button with accessible name `跳至最前頁` exists.

- [ ] **Step 3: Add the enrollment first/last controls**

Change the Lucide import in `EnrollmentTab.jsx` to:

```jsx
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react'
```

Insert this button immediately before the existing `btn-history-prev` button:

```jsx
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setHistoryPage(1)}
              disabled={historyPage === 1}
              id="btn-history-first"
              aria-label="跳至最前頁"
              title="跳至最前頁"
            >
              <ChevronsLeft size={16} style={{ display: 'block' }} />
            </button>
```

Insert this button immediately after the existing `btn-history-next` button:

```jsx
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setHistoryPage(totalHistoryPages)}
              disabled={historyPage === totalHistoryPages}
              id="btn-history-last"
              aria-label="跳至最尾頁"
              title="跳至最尾頁"
            >
              <ChevronsRight size={16} style={{ display: 'block' }} />
            </button>
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- --run src/components/enrollment/EnrollmentTab.test.jsx
```

Working directory: `dashboard`

Expected: all `EnrollmentTab.test.jsx` tests PASS.

- [ ] **Step 5: Commit the enrollment pagination change**

```powershell
git add -- dashboard/src/components/enrollment/EnrollmentTab.jsx dashboard/src/components/enrollment/EnrollmentTab.test.jsx
git commit -m "feat(enrollment): add first and last page controls"
```

### Task 3: Full Verification

**Files:**

- Verify only; no file changes expected.

**Interfaces:**

- Consumes: completed Task 1 and Task 2
- Produces: verified dashboard test, lint, and production-build results

- [ ] **Step 1: Run the complete dashboard test suite**

Run:

```powershell
npm test
```

Working directory: `dashboard`

Expected: all tests PASS with zero failed test files.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Working directory: `dashboard`

Expected: exit code `0` with no lint errors.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Working directory: `dashboard`

Expected: exit code `0` and Vite reports a completed production build.

- [ ] **Step 4: Confirm the working tree contains no unintended changes**

Run:

```powershell
git status --short
git diff --check
```

Working directory: repository root.

Expected: only pre-existing unrelated user changes remain; `git diff --check` emits no whitespace errors.
