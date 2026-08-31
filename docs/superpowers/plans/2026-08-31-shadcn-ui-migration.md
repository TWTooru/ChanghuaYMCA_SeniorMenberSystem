# shadcn/ui Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port base shadcn/ui components (`badge`, `collapsible`, `dialog`, `progress`, `select`, `table`), theme tokens, and integrate them into YMCA dashboard feature modules (Overview, Students, Courses, Enrollment, Admin) while preserving active business features.

**Architecture:** Copy Base UI-backed shadcn primitives and theme tokens to `dashboard/src/components/ui/` and `index.css`. Incrementally migrate UI in each feature module while preserving domain-specific extensions (such as season/receipt search in enrollment, age filtering and merge student in students, and authoritative role authorization in admin). Validate continuously with Vitest unit tests.

**Tech Stack:** React 19, Vite, Tailwind CSS, `@base-ui/react`, `class-variance-authority`, `lucide-react`, Vitest.

## Global Constraints

- Never break or drop existing business logic: retain `season` & receipt search in `EnrollmentTab`, age filters and `onShowMerge` in `StudentFilters`, and multi-owner/admin authorization in `AdminAccountPage`.
- All tests must pass with `npm test` in `dashboard/`.
- Production build must succeed with `npm run build` in `dashboard/`.

---

### Task 1: UI Primitives, Theme Tokens & Scroll Lock Hook

**Files:**
- Create: `dashboard/src/components/ui/badge.jsx`
- Create: `dashboard/src/components/ui/collapsible.jsx`
- Create: `dashboard/src/components/ui/dialog.jsx`
- Create: `dashboard/src/components/ui/progress.jsx`
- Create: `dashboard/src/components/ui/select.jsx`
- Create: `dashboard/src/components/ui/table.jsx`
- Create: `dashboard/src/hooks/useBodyScrollLock.js`
- Modify: `dashboard/src/index.css`
- Test: `dashboard/src/components/common/ConfirmDialog.test.jsx`

**Interfaces:**
- Produces:
  - `Badge` from `@/components/ui/badge`
  - `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent` from `@/components/ui/collapsible`
  - `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` from `@/components/ui/dialog`
  - `Progress` from `@/components/ui/progress`
  - `Select`, `SelectGroup`, `SelectValue`, `SelectTrigger`, `SelectContent`, `SelectLabel`, `SelectItem`, `SelectSeparator`, `SelectScrollUpButton`, `SelectScrollDownButton` from `@/components/ui/select`
  - `Table`, `TableHeader`, `TableBody`, `TableFooter`, `TableHead`, `TableRow`, `TableCell`, `TableCaption` from `@/components/ui/table`
  - `useBodyScrollLock(isLocked)` from `@/hooks/useBodyScrollLock`

- [ ] **Step 1: Create base UI primitive files and `useBodyScrollLock`**

Copy `badge.jsx`, `collapsible.jsx`, `dialog.jsx`, `progress.jsx`, `select.jsx`, `table.jsx` from `work2/dashboard/src/components/ui/` into `dashboard/src/components/ui/` and create `dashboard/src/hooks/useBodyScrollLock.js`.

- [ ] **Step 2: Update `dashboard/src/index.css` with theme tokens**

Update `:root`, `:root[data-theme="light"]`, `.light`, and `.dark` variables in `dashboard/src/index.css` matching `work2`.

- [ ] **Step 3: Add `ConfirmDialog.test.jsx` to test Dialog scroll locks and rendering**

Add `dashboard/src/components/common/ConfirmDialog.test.jsx` importing `Dialog` and `DialogContent` from `../ui/dialog`.

- [ ] **Step 4: Run test to verify primitives and scroll lock**

Run: `npm test dashboard/src/components/common/ConfirmDialog.test.jsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/ui/ dashboard/src/hooks/useBodyScrollLock.js dashboard/src/index.css dashboard/src/components/common/ConfirmDialog.test.jsx
git commit -m "feat: add shadcn ui primitives and sync theme tokens"
```

---

### Task 2: Overview Dashboard Migration

**Files:**
- Modify: `dashboard/src/components/overview/CollapsiblePanel.jsx`
- Modify: `dashboard/src/components/overview/CollapsiblePanel.test.jsx`
- Modify: `dashboard/src/components/overview/KpiCards.jsx`
- Modify: `dashboard/src/components/overview/KpiCards.test.jsx`
- Modify: `dashboard/src/components/overview/PeriodTrendChart.jsx`
- Modify: `dashboard/src/components/overview/PeriodTrendChart.test.jsx`
- Modify: `dashboard/src/components/overview/OverviewTab.css`
- Modify: `dashboard/src/components/overview/OverviewTab.order.test.jsx`

**Interfaces:**
- Consumes:
  - `Button` from `@/components/ui/button`
  - `Card`, `CardContent`, `CardHeader` from `@/components/ui/card`
  - `Collapsible`, `CollapsibleContent`, `CollapsibleTrigger` from `@/components/ui/collapsible`
  - `Badge` from `@/components/ui/badge`
  - `Progress` from `@/components/ui/progress`

- [ ] **Step 1: Update `CollapsiblePanel.jsx` and its tests**

Refactor `CollapsiblePanel.jsx` to wrap `Collapsible` + `Card` + `Button` and update `CollapsiblePanel.test.jsx`.

- [ ] **Step 2: Update `KpiCards.jsx` and its tests**

Refactor `KpiCards.jsx` to use `Card`, `CardContent`, and `Badge`, keeping active season revenue and enrollment count props. Update `KpiCards.test.jsx`.

- [ ] **Step 3: Update `PeriodTrendChart.jsx`, `OverviewTab.css`, and related tests**

Refactor `PeriodTrendChart.jsx` to use `Progress`. Update `OverviewTab.css` and verify `PeriodTrendChart.test.jsx` and `OverviewTab.order.test.jsx`.

- [ ] **Step 4: Run overview tests**

Run: `npm test dashboard/src/components/overview/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/overview/
git commit -m "feat: apply shadcn UI to overview dashboard"
```

---

### Task 3: Student Management Migration

**Files:**
- Modify: `dashboard/src/components/students/AddStudentModal.jsx`
- Modify: `dashboard/src/components/students/AddStudentModal.test.jsx`
- Modify: `dashboard/src/components/students/StudentFilters.jsx`
- Modify: `dashboard/src/components/students/StudentTable.jsx`

**Interfaces:**
- Consumes:
  - `Button` from `@/components/ui/button`
  - `Input` from `@/components/ui/input`
  - `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
  - `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell` from `@/components/ui/table`
  - `Dialog`, `DialogClose`, `DialogContent`, `DialogTitle` from `@/components/ui/dialog`

- [ ] **Step 1: Migrate `AddStudentModal.jsx` to shadcn `Dialog` and `Button`**

Wrap modal content in `Dialog`, `DialogContent`, `DialogTitle`, `DialogClose` and `Button`, updating `AddStudentModal.test.jsx` to assert Escape key closing.

- [ ] **Step 2: Migrate `StudentFilters.jsx` to shadcn `Input`, `Select`, and `Button`**

Refactor search input, gender filter, education filter, and age filter using shadcn components while preserving `onShowMerge` ("合併學員") button and `studentAgeFilter`.

- [ ] **Step 3: Migrate `StudentTable.jsx` to shadcn `Table`, `Select`, and `Button`**

Refactor data table to use `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell`, `Select` for page size, and `Button` for sorting/pagination while preserving all existing columns and action handlers.

- [ ] **Step 4: Run student tests**

Run: `npm test dashboard/src/components/students/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/students/
git commit -m "feat: use shadcn UI in student management components"
```

---

### Task 4: Courses & Enrollment Migration

**Files:**
- Modify: `dashboard/src/components/courses/CourseManagementTab.jsx`
- Modify: `dashboard/src/components/courses/CourseManagementTab.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`

**Interfaces:**
- Consumes:
  - `Badge` from `@/components/ui/badge`
  - `Button` from `@/components/ui/button`
  - `Input` from `@/components/ui/input`
  - `Label` from `@/components/ui/label`
  - `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
  - `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`

- [ ] **Step 1: Migrate `CourseManagementTab.jsx` to shadcn components**

Use `Badge`, `Button`, `Input`, `Table` in `CourseManagementTab.jsx` and verify `CourseManagementTab.test.jsx`.

- [ ] **Step 2: Migrate `EnrollmentTab.jsx` to shadcn components**

Use `Badge`, `Button`, `Input`, `Label`, `Select`, `Table` in `EnrollmentTab.jsx` while keeping `season` sorting/filtering and receipt search logic intact.

- [ ] **Step 3: Run course and enrollment tests**

Run: `npm test dashboard/src/components/courses/ dashboard/src/components/enrollment/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/courses/ dashboard/src/components/enrollment/
git commit -m "feat: apply shadcn UI to courses and enrollment tabs"
```

---

### Task 5: Admin Account Page Migration

**Files:**
- Modify: `dashboard/src/components/admin/AdminAccountPage.jsx`
- Modify: `dashboard/src/components/admin/AdminAccountPage.test.jsx`

**Interfaces:**
- Consumes:
  - `Badge` from `@/components/ui/badge`
  - `Button` from `@/components/ui/button`
  - `Card` from `@/components/ui/card`
  - `Select`, `SelectContent`, `SelectItem`, `SelectTrigger`, `SelectValue` from `@/components/ui/select`
  - `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow` from `@/components/ui/table`

- [ ] **Step 1: Migrate `AdminAccountPage.jsx` to shadcn components**

Refactor `AdminAccountPage.jsx` to use `Badge`, `Button`, `Card`, `Select`, `Table` while strictly preserving `work`'s authoritative owner/admin permission policies and error mappings.

- [ ] **Step 2: Run admin tests**

Run: `npm test dashboard/src/components/admin/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/admin/
git commit -m "feat: apply shadcn UI to admin account page"
```

---

### Task 6: Full Integration & Build Verification

**Files:**
- Test all components across `dashboard/`

- [ ] **Step 1: Run full test suite**

Run: `npm test` inside `dashboard/`
Expected: PASS with 0 failures

- [ ] **Step 2: Run linter and build check**

Run: `npm run lint` and `npm run build` inside `dashboard/`
Expected: PASS with 0 build errors

- [ ] **Step 3: Commit any final integration adjustments**

```bash
git commit -am "chore: complete shadcn UI integration and verification"
```
