# Design Specification: Porting shadcn/ui Components to YMCA Member System

- **Date**: 2026-08-31
- **Status**: Approved
- **Scope**: Port base shadcn/ui primitives, theme tokens, and integrate shadcn/ui into dashboard feature modules (Overview, Students, Courses, Enrollment, Admin) while preserving active business features.

---

## 1. Overview & Objectives

Port the shadcn/ui component architecture and styles from `C:\Users\user\Desktop\work2` to `C:\Users\user\Desktop\work` (`TWTooru/YMCA_MenberSystem`).
This unifies design tokens, improves component modularity, and utilizes Base UI primitives wrapped in standard shadcn component conventions.

Key goals:
1. Copy all required `components/ui/` primitives (`badge`, `collapsible`, `dialog`, `progress`, `select`, `table`).
2. Sync CSS design tokens and theme variables (`index.css` & `OverviewTab.css`).
3. Refactor feature modules to use shadcn/ui while keeping existing project features (e.g. merge student, age filters, owner permissions).
4. Maintain 100% test pass rate with Vitest (`npm test`) and successful production build (`npm run build`).

---

## 2. Architecture & Components

### 2.1 Base UI Primitives (`dashboard/src/components/ui/`)

The following primitives will be added/updated under `dashboard/src/components/ui/`:

- `badge.jsx`: Badge component with variants (`default`, `secondary`, `destructive`, `outline`).
- `button.jsx`: Button component with variants and sizes (already present, verify consistency).
- `card.jsx`: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter (already present).
- `collapsible.jsx`: Collapsible, CollapsibleTrigger, CollapsibleContent using `@base-ui/react/collapsible`.
- `dialog.jsx`: Dialog, DialogTrigger, DialogPortal, DialogClose, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription using `@base-ui/react/dialog`.
- `input.jsx`: Text input primitive (already present).
- `label.jsx`: Form label primitive (already present).
- `progress.jsx`: Progress bar component using `@base-ui/react/progress`.
- `select.jsx`: Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem, SelectSeparator, SelectScrollUpButton, SelectScrollDownButton using `@base-ui/react/select`.
- `table.jsx`: Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption.

### 2.2 Design Tokens & Theme (`dashboard/src/index.css`)

- Sync updated HSL color tokens for light mode (`:root`, `:root[data-theme="light"]`, `.light`) and dark mode (`.dark`).
- Include CSS variables: `--background`, `--foreground`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--accent`, `--accent-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--chart-1` through `--chart-5`, `--radius`.

---

## 3. Module Migration Plan

### 3.1 Overview Dashboard (`components/overview/`)
- **`CollapsiblePanel.jsx`**: Replaced with `Collapsible` + `Card` + `Button`.
- **`KpiCards.jsx`**: Replaced with `Card` and `Badge` badges for trends/status.
- **`PeriodTrendChart.jsx`**: Replaced raw progress bars with `Progress` component.
- **`OverviewTab.css`**: Updated for card layouts and theme variables.
- **Tests**: Update test selectors/assertions to match new DOM structure (`CollapsiblePanel.test.jsx`, `KpiCards.test.jsx`, `PeriodTrendChart.test.jsx`, `OverviewTab.order.test.jsx`).

### 3.2 Student Management (`components/students/`)
- **`AddStudentModal.jsx`**: Wrap dialog modal in `Dialog`, `DialogContent`, `DialogTitle`, `DialogClose` and `Button`.
- **`StudentFilters.jsx`**: Replace raw HTML inputs/selects with `Input`, `Select`, and `Button`. Keep existing filters (`studentAgeFilter`, `studentEduFilter`, `studentGenderFilter`, `studentSearch`) and action buttons (`onShowMerge`, `onShowAddStudent`).
- **`StudentTable.jsx`**: Replace HTML table with `Table`, `TableHeader`, `TableHead`, `TableBody`, `TableRow`, `TableCell`, pagination `Button`s and `Select` for page size. Retain all columns (including age, emergency contact, relationship) and click interactions.
- **Tests**: Verify `AddStudentModal.test.jsx`, `StudentFilters.test.jsx`, `StudentTable.test.jsx` (or integration tests).

### 3.3 Courses & Enrollment (`components/courses/`, `components/enrollment/`)
- **`CourseManagementTab.jsx`**: Adopt `Badge`, `Button`, `Input`, `Table`.
- **`EnrollmentTab.jsx`**: Adopt `Badge`, `Button`, `Input`, `Label`, `Select`, `Table`.
- **Tests**: Run corresponding test suites to confirm UI changes remain functional.

### 3.4 Admin & Auth (`components/admin/`, `components/common/`)
- **`AdminAccountPage.jsx`**: Adopt `Badge`, `Button`, `Card`, `Select`, `Table` while preserving owner/admin role authorization rules and error message mappings.
- **`ConfirmDialog.test.jsx`**: Add/verify tests for dialog layering and scroll locks.

---

## 4. Verification & Quality Gates

1. **Unit Tests**: Run `npm test` in `dashboard/` with Vitest to ensure all tests pass.
2. **Build Verification**: Run `npm run build` to ensure clean bundling with zero errors.
3. **Lint Check**: Run `npm run lint` with oxlint.
