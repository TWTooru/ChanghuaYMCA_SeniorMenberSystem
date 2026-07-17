# Student ID Relations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 將 dashboard 中學員與選課紀錄的關聯統一改為 `student_id`，避免同名學員顯示或開啟錯誤資料。

**Architecture:** 在 domain 層新增兩個純函式 helper，集中處理 ID 正規化、學員查找與選課篩選。`StudentDetailModal` 與 `EnrollmentTab` 只透過 helper 建立關聯；`student_name` 繼續供搜尋與顯示，不作為 fallback 關聯鍵。

**Tech Stack:** React 19, JavaScript/JSX, Vite 8, Vitest 4, Testing Library, Supabase JS

## Global Constraints

- 不修改 Supabase schema、RLS 或任何 `supabase/migrations/` 檔案。
- 不修改元件 props 或 Excel 匯入格式。
- `student_name` 只能用於搜尋與顯示，不得作為學員／選課關聯鍵。
- ID 比對前使用 `String(id)` 正規化；`null`、`undefined`、空字串視為無效 ID。
- 不以姓名作 fallback。
- 採測試先行；每個 Task 完成後提交一次 commit。

---

### Task 1: 建立 student_id 關聯 helper

**Files:**
- Create: `dashboard/src/domain/studentRelations.js`
- Test: `dashboard/src/domain/studentRelations.test.js`

**Interfaces:**
- Produces: `getStudentById(students, studentId) -> student | null`
- Produces: `getEnrollmentsForStudent(enrollments, studentId) -> enrollment[]`
- ID comparisons accept string or number values and compare normalized strings.

- [ ] **Step 1: Write the failing unit tests**

Create `dashboard/src/domain/studentRelations.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { getEnrollmentsForStudent, getStudentById } from './studentRelations'

const students = [
  { student_id: '1', name: '王小明' },
  { student_id: '2', name: '王小明' }
]

const enrollments = [
  { enrollment_id: 10, student_id: '1', student_name: '王小明', season: '第十四期' },
  { enrollment_id: 11, student_id: 2, student_name: '王小明', season: '第十五期' }
]

describe('studentRelations', () => {
  it('finds a student by normalized student_id instead of name', () => {
    expect(getStudentById(students, 2)).toBe(students[1])
  })

  it('returns null for missing or invalid student_id values', () => {
    expect(getStudentById(students, '999')).toBeNull()
    expect(getStudentById(students, '')).toBeNull()
    expect(getStudentById(null, '1')).toBeNull()
  })

  it('filters enrollments by normalized student_id when names are identical', () => {
    expect(getEnrollmentsForStudent(enrollments, '2')).toEqual([enrollments[1]])
  })

  it('returns an empty array for missing or invalid enrollment inputs', () => {
    expect(getEnrollmentsForStudent(enrollments, '999')).toEqual([])
    expect(getEnrollmentsForStudent(enrollments, null)).toEqual([])
    expect(getEnrollmentsForStudent(undefined, '1')).toEqual([])
  })
})
```

- [ ] **Step 2: Run the unit test to verify RED**

Run from `dashboard/`:

```powershell
npm test -- src/domain/studentRelations.test.js
```

Expected: FAIL because `./studentRelations` does not exist.

- [ ] **Step 3: Implement the minimal relation helpers**

Create `dashboard/src/domain/studentRelations.js`:

```js
function normalizeStudentId(value) {
  if (value === null || value === undefined || value === '') return null
  return String(value)
}

export function getStudentById(students, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(students) || normalizedId === null) return null

  return students.find(student => (
    normalizeStudentId(student?.student_id) === normalizedId
  )) || null
}

export function getEnrollmentsForStudent(enrollments, studentId) {
  const normalizedId = normalizeStudentId(studentId)
  if (!Array.isArray(enrollments) || normalizedId === null) return []

  return enrollments.filter(enrollment => (
    normalizeStudentId(enrollment?.student_id) === normalizedId
  ))
}
```

- [ ] **Step 4: Run the unit test to verify GREEN**

Run:

```powershell
npm test -- src/domain/studentRelations.test.js
```

Expected: PASS, 4 tests passing.

- [ ] **Step 5: Commit Task 1**

```powershell
git add dashboard/src/domain/studentRelations.js dashboard/src/domain/studentRelations.test.js
git commit -m "fix: add student id relation helpers"
```

---

### Task 2: 將學員詳情與選課列表切換為 student_id 關聯

**Files:**
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Modify: `dashboard/src/components/students/StudentDetailComponents.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx`
- Create: `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`

**Interfaces:**
- Consumes: `getStudentById(students, studentId) -> student | null`
- Consumes: `getEnrollmentsForStudent(enrollments, studentId) -> enrollment[]`
- Preserves: `StudentDetailModal({ student, enrollments, onClose, onAddEnrollment, onRefresh })`
- Preserves: `EnrollmentTab({ students, enrollments, onSelectStudent })`

- [ ] **Step 1: Add the failing duplicate-name test for StudentDetailModal**

In `dashboard/src/components/students/StudentDetailComponents.test.jsx`, add this import:

```jsx
import StudentDetailModal from './StudentDetailModal'
```

Add this test inside the existing `describe('Student detail components', ...)` block:

```jsx
  it('shows only enrollments belonging to the selected student_id when names match', () => {
    render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', student_name: '王小明', season: '第十四期', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', student_name: '王小明', season: '第十五期', courses: ['手機課'] }
        ]}
        onClose={vi.fn()}
        onAddEnrollment={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByText('第十五期')).not.toBeNull()
    expect(screen.getByText('手機課')).not.toBeNull()
    expect(screen.queryByText('第十四期')).toBeNull()
    expect(screen.queryByText('電腦課')).toBeNull()
  })
```

- [ ] **Step 2: Add the failing duplicate-name test for EnrollmentTab**

Create `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`:

```jsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import EnrollmentTab from './EnrollmentTab'

describe('EnrollmentTab', () => {
  it('opens the student matched by student_id when names are identical', () => {
    const students = [
      { student_id: '1', name: '王小明' },
      { student_id: '2', name: '王小明' }
    ]
    const onSelectStudent = vi.fn()

    render(
      <EnrollmentTab
        students={students}
        enrollments={[
          {
            enrollment_id: 11,
            student_id: 2,
            student_name: '王小明',
            season: '第十五期',
            reg_type: '續',
            refunded: false,
            courses: ['手機課']
          }
        ]}
        onSelectStudent={onSelectStudent}
      />
    )

    fireEvent.click(screen.getByText('手機課').closest('tr'))

    expect(onSelectStudent).toHaveBeenCalledOnce()
    expect(onSelectStudent).toHaveBeenCalledWith(students[1])
  })

  it('does not open another student when an enrollment student_id is missing', () => {
    const onSelectStudent = vi.fn()

    render(
      <EnrollmentTab
        students={[{ student_id: '1', name: '王小明' }]}
        enrollments={[
          {
            enrollment_id: 12,
            student_id: '999',
            student_name: '王小明',
            season: '第十五期',
            reg_type: '續',
            refunded: false,
            courses: ['肌力課']
          }
        ]}
        onSelectStudent={onSelectStudent}
      />
    )

    fireEvent.click(screen.getByText('肌力課').closest('tr'))

    expect(onSelectStudent).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Run the component tests to verify RED**

Run from `dashboard/`:

```powershell
npm test -- src/components/students/StudentDetailComponents.test.jsx src/components/enrollment/EnrollmentTab.test.jsx
```

Expected: FAIL because the current components still match students and enrollments by name.

- [ ] **Step 4: Update StudentDetailModal to use getEnrollmentsForStudent**

In `dashboard/src/components/students/StudentDetailModal.jsx`, add:

```jsx
import { getEnrollmentsForStudent } from '../../domain/studentRelations'
```

Replace the current `studentTimeline` memo with:

```jsx
  const studentTimeline = useMemo(() => {
    if (!student || !enrollments) return []
    return getEnrollmentsForStudent(enrollments, student.student_id)
      .sort((a, b) => SEASONS_ORDER.indexOf(a.season) - SEASONS_ORDER.indexOf(b.season))
  }, [student, enrollments])
```

- [ ] **Step 5: Update EnrollmentTab to use getStudentById**

In `dashboard/src/components/enrollment/EnrollmentTab.jsx`, add:

```jsx
import { getStudentById } from '../../domain/studentRelations'
```

Replace the table row `onClick` handler with:

```jsx
                    onClick={() => {
                      const student = getStudentById(students, e.student_id)
                      if (student && onSelectStudent) onSelectStudent(student)
                    }}
```

- [ ] **Step 6: Run the component tests to verify GREEN**

Run:

```powershell
npm test -- src/components/students/StudentDetailComponents.test.jsx src/components/enrollment/EnrollmentTab.test.jsx
```

Expected: PASS, including the duplicate-name and orphan-enrollment cases.

- [ ] **Step 7: Verify no name-based relation remains**

Run from the repository root:

```powershell
rg -n "student_name === student\.name|students\.find\(s => s\.name === e\.student_name" dashboard/src
```

Expected: no matches and `rg` exit code 1.

- [ ] **Step 8: Run full verification**

Run from `dashboard/`:

```powershell
npm test
npm run lint
npm run build
```

Expected:

- All tests pass.
- Lint exits 0 with no new warning beyond the four existing warnings in `AuthContext.jsx`, `StudentListTab.jsx`, and `AddStudentModal.jsx`.
- Vite production build exits 0; the existing bundle-size warning is acceptable for this task.

Run from the repository root:

```powershell
git diff --exit-code -- supabase/migrations
```

Expected: exit code 0 and no migration diff.

- [ ] **Step 9: Commit Task 2**

```powershell
git add dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/components/enrollment/EnrollmentTab.jsx dashboard/src/components/enrollment/EnrollmentTab.test.jsx
git commit -m "fix: relate enrollments to students by student id"
```
