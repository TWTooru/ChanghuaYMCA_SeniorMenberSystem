# Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve maintainability by decomposing oversized files, consolidating the service layer, and splitting CSS — without changing any business logic or UI behavior.

**Architecture:** Extract custom hooks and sub-components from oversized files. Create a `studentService` to mirror the existing `enrollmentService` pattern. Physically split the monolithic `App.css` by component group.

**Tech Stack:** React 19, Vite 8, Vitest, Supabase JS client, Tailwind CSS 3

## Global Constraints

- Zero changes to business logic, UI behavior, or database schema
- All existing tests must continue to pass after each task
- Follow the existing service pattern: functions accept `client` as first parameter
- Follow the existing test pattern: mock supabase client as a plain object with chained methods
- Run `npm run test` from `dashboard/` to verify; run `npm run build` from `dashboard/` to verify CSS imports
- Commit after each task with a descriptive message

---

### Task 1: Create `studentService.js` with tests

**Files:**
- Create: `dashboard/src/services/studentService.js`
- Create: `dashboard/src/services/studentService.test.js`

**Interfaces:**
- Consumes: nothing (new file)
- Produces:
  - `createStudent(client, studentData) → Promise<{data, error}>` — inserts one student row
  - `updateStudent(client, studentId, payload) → Promise<void>` — updates student by `student_id`, throws on error
  - `deleteStudent(client, studentId) → Promise<void>` — deletes student by `student_id`, throws on error (DB cascade handles enrollments/courses)

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/services/studentService.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { createStudent, updateStudent, deleteStudent } from './studentService'

describe('createStudent', () => {
  it('inserts a student row and returns the result', async () => {
    const studentData = { student_id: '99', name: '測試學員', gender: '男' }
    const client = {
      from(table) {
        return {
          insert: async (rows) => {
            expect(table).toBe('students')
            expect(rows).toEqual([studentData])
            return { error: null }
          }
        }
      }
    }

    await expect(createStudent(client, studentData)).resolves.toBeUndefined()
  })

  it('throws when insert fails', async () => {
    const client = {
      from() {
        return {
          insert: async () => ({ error: new Error('duplicate key') })
        }
      }
    }

    await expect(createStudent(client, { student_id: '1', name: 'x' })).rejects.toThrow('duplicate key')
  })
})

describe('updateStudent', () => {
  it('updates a student by student_id', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push(table)
        return {
          update(payload) {
            calls.push({ op: 'update', payload })
            return {
              eq: async (col, val) => {
                calls.push({ op: 'eq', col, val })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await updateStudent(client, 'S-001', { name: '新名字' })
    expect(calls).toContainEqual({ op: 'update', payload: { name: '新名字' } })
    expect(calls).toContainEqual({ op: 'eq', col: 'student_id', val: 'S-001' })
  })

  it('throws when update fails', async () => {
    const client = {
      from() {
        return {
          update() {
            return {
              eq: async () => ({ error: new Error('update denied') })
            }
          }
        }
      }
    }

    await expect(updateStudent(client, '1', {})).rejects.toThrow('update denied')
  })
})

describe('deleteStudent', () => {
  it('deletes a student by student_id (DB cascade handles children)', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push(table)
        return {
          delete() {
            calls.push('delete')
            return {
              eq: async (col, val) => {
                calls.push({ col, val })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await deleteStudent(client, 'S-001')
    expect(calls).toContain('students')
    expect(calls).toContainEqual({ col: 'student_id', val: 'S-001' })
  })

  it('throws when delete fails', async () => {
    const client = {
      from() {
        return {
          delete() {
            return {
              eq: async () => ({ error: new Error('delete denied') })
            }
          }
        }
      }
    }

    await expect(deleteStudent(client, '1')).rejects.toThrow('delete denied')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/services/studentService.test.js`
Expected: FAIL — `studentService` module not found

- [ ] **Step 3: Write the implementation**

Create `dashboard/src/services/studentService.js`:

```js
export async function createStudent(client, studentData) {
  const { error } = await client.from('students').insert([studentData])
  if (error) throw error
}

export async function updateStudent(client, studentId, payload) {
  const { error } = await client.from('students').update(payload).eq('student_id', studentId)
  if (error) throw error
}

export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/services/studentService.test.js`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/services/studentService.js dashboard/src/services/studentService.test.js
git commit -m "feat: create studentService with create/update/delete"
```

---

### Task 2: Add `deleteEnrollment` to `enrollmentService.js`

**Files:**
- Modify: `dashboard/src/services/enrollmentService.js`
- Modify: `dashboard/src/services/enrollmentService.test.js`

**Interfaces:**
- Consumes: nothing new
- Produces:
  - `deleteEnrollment(client, enrollmentId) → Promise<void>` — deletes enrollment by `enrollment_id`, throws on error (DB cascade handles courses)

- [ ] **Step 1: Write the failing test**

Append to `dashboard/src/services/enrollmentService.test.js` (after the last `})` of the existing `describe` block):

```js
import { deleteEnrollment } from './enrollmentService'

describe('deleteEnrollment', () => {
  it('deletes an enrollment by enrollment_id (DB cascade handles courses)', async () => {
    const calls = []
    const client = {
      from(table) {
        calls.push(table)
        return {
          delete() {
            calls.push('delete')
            return {
              eq: async (col, val) => {
                calls.push({ col, val })
                return { error: null }
              }
            }
          }
        }
      }
    }

    await deleteEnrollment(client, 42)
    expect(calls).toContain('enrollments')
    expect(calls).toContainEqual({ col: 'enrollment_id', val: 42 })
  })

  it('throws when delete fails', async () => {
    const client = {
      from() {
        return {
          delete() {
            return {
              eq: async () => ({ error: new Error('delete denied') })
            }
          }
        }
      }
    }

    await expect(deleteEnrollment(client, 1)).rejects.toThrow('delete denied')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/services/enrollmentService.test.js`
Expected: FAIL — `deleteEnrollment` is not exported

- [ ] **Step 3: Add implementation**

Append to `dashboard/src/services/enrollmentService.js` (after the existing `createEnrollmentWithCourses` function):

```js
export async function deleteEnrollment(client, enrollmentId) {
  const { error } = await client.from('enrollments').delete().eq('enrollment_id', enrollmentId)
  if (error) throw error
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/services/enrollmentService.test.js`
Expected: All tests PASS (existing 3 + new 2)

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/services/enrollmentService.js dashboard/src/services/enrollmentService.test.js
git commit -m "feat: add deleteEnrollment to enrollmentService"
```

---

### Task 3: Wire components to use services instead of direct supabase calls

**Files:**
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx` (lines 5, 65-83, 85-101)
- Modify: `dashboard/src/components/students/AddStudentModal.jsx` (lines 3, 59-71)
- Modify: `dashboard/src/components/students/StudentEditForm.jsx` (lines 2, 30-36)
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.jsx` (lines 3, 24)

**Interfaces:**
- Consumes:
  - `studentService.createStudent(client, data)` from Task 1
  - `studentService.updateStudent(client, id, payload)` from Task 1
  - `studentService.deleteStudent(client, id)` from Task 1
  - `enrollmentService.deleteEnrollment(client, id)` from Task 2
- Produces: no new interfaces (behavior unchanged)

- [ ] **Step 1: Update `StudentDetailModal.jsx`**

Replace import (line 5):
```js
// Before:
import { supabase } from '../../lib/supabaseClient'
// After:
import { supabase } from '../../lib/supabaseClient'
import { deleteStudent } from '../../services/studentService'
import { deleteEnrollment } from '../../services/enrollmentService'
```

Replace `handleDeleteStudent` (lines 65-83):
```js
  const handleDeleteStudent = async () => {
    if (!permissions.canDeleteStudent) {
      setShowDeleteConfirm(false)
      return
    }

    try {
      await deleteStudent(supabase, student.student_id)
      alert('學員已刪除')
      if (onRefresh) onRefresh()
      onClose()
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }
```

Replace `handleDeleteEnrollment` (lines 85-101):
```js
  const handleDeleteEnrollment = async (enrollmentId) => {
    if (!permissions.canDeleteEnrollment) {
      setShowDeleteEnrollConfirm(null)
      return
    }

    try {
      await deleteEnrollment(supabase, enrollmentId)
      alert('選課紀錄已刪除')
      if (onRefresh) onRefresh()
      setShowDeleteEnrollConfirm(null)
    } catch (err) {
      alert('伺服器錯誤: ' + err.message)
    }
  }
```

- [ ] **Step 2: Update `AddStudentModal.jsx`**

Replace import (line 3):
```js
// Before:
import { supabase } from '../../lib/supabaseClient'
// After:
import { supabase } from '../../lib/supabaseClient'
import { createStudent } from '../../services/studentService'
```

Replace the inner `insertStudent` function (lines 59-71):
```js
    const insertStudent = async () => {
      try {
        await createStudent(supabase, bodyData);
        alert("新增成功！");
        if (onRefresh) onRefresh();
        onClose();
      } catch (err) {
        alert(err.message);
      }
    };
```

- [ ] **Step 3: Update `StudentEditForm.jsx`**

Replace import (line 2):
```js
// Before:
import { supabase } from '../../lib/supabaseClient'
// After:
import { supabase } from '../../lib/supabaseClient'
import { updateStudent } from '../../services/studentService'
```

Replace the supabase call inside `handleSave` (line 36):
```js
      // Before:
      const { error } = await supabase.from('students').update(payload).eq('student_id', student.student_id)
      if (error) throw error
      // After:
      await updateStudent(supabase, student.student_id, payload)
```

- [ ] **Step 4: Update `AddEnrollModal.jsx`**

Remove line 3 (`import { supabase } from '../../lib/supabaseClient'`). The `supabase` import is still needed for `createEnrollmentWithCourses`. Update line 24 instead:

Actually, `AddEnrollModal` already uses `createEnrollmentWithCourses` from the service, but it imports `supabase` to pass as the client. This is the intended pattern — keep it as-is. No change needed here.

- [ ] **Step 5: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/StudentEditForm.jsx
git commit -m "refactor: wire student components to use service layer"
```

---

### Task 4: Extract custom hooks from App.jsx

**Files:**
- Create: `dashboard/src/hooks/useStats.js`
- Create: `dashboard/src/hooks/useStats.test.js`
- Create: `dashboard/src/hooks/useExportHandler.js`
- Create: `dashboard/src/hooks/useExportHandler.test.js`
- Create: `dashboard/src/hooks/useStudentSelection.js`
- Create: `dashboard/src/hooks/useStudentSelection.test.js`
- Modify: `dashboard/src/App.jsx`

**Interfaces:**
- Consumes: `normalizeEducation` from `domain/studentFields`, `exportToExcel` from `lib/excelExport`
- Produces:
  - `useStats(students, enrollments) → stats` object with keys: `totalStudents`, `totalRegistrations`, `totalRefunds`, `males`, `females`, `ageGroups`, `eduCounts`, `popularCourses`
  - `useExportHandler(students, enrollments) → handleExport({ exportScope, selectedSeason, options })`
  - `useStudentSelection(students) → { selectedStudent, studentDetailInitialTab, studentDetailIsTabbed, openStudentDetail, closeStudentDetail }`

- [ ] **Step 1: Create `useStats.js` with test**

Create `dashboard/src/hooks/useStats.js`:
```js
import { useMemo } from 'react'
import { normalizeEducation } from '../domain/studentFields'

export default function useStats(students, enrollments) {
  return useMemo(() => {
    if (!students || students.length === 0) {
      return {
        totalStudents: 0, totalRegistrations: 0, totalRefunds: 0,
        males: 0, females: 0, ageGroups: {}, eduCounts: {}, popularCourses: []
      }
    }
    const totalStudents = students.length
    const totalRegistrations = enrollments.length
    const totalRefunds = enrollments.filter(e => e.refunded).length
    const males = students.filter(s => s.gender === '男').length
    const females = students.filter(s => s.gender === '女').length

    const ageGroups = {
      '50歲以下': 0, '50-59歲': 0, '60-69歲': 0, '70-79歲': 0, '80歲以上': 0, '未知': 0
    }
    students.forEach(s => {
      const age = s.age
      if (!age) ageGroups['未知']++
      else if (age < 50) ageGroups['50歲以下']++
      else if (age >= 50 && age < 60) ageGroups['50-59歲']++
      else if (age >= 60 && age < 70) ageGroups['60-69歲']++
      else if (age >= 70 && age < 80) ageGroups['70-79歲']++
      else ageGroups['80歲以上']++
    })

    const eduCounts = {}
    students.forEach(s => {
      const cleanEdu = normalizeEducation(s.education)
      eduCounts[cleanEdu] = (eduCounts[cleanEdu] || 0) + 1
    })

    const courseCounts = {}
    enrollments.forEach(e => {
      if (!e.refunded) {
        e.courses.forEach(c => {
          courseCounts[c] = (courseCounts[c] || 0) + 1
        })
      }
    })

    const popularCourses = Object.entries(courseCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)

    return {
      totalStudents, totalRegistrations, totalRefunds,
      males, females, ageGroups, eduCounts, popularCourses
    }
  }, [students, enrollments])
}
```

Create `dashboard/src/hooks/useStats.test.js`:
```js
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStats from './useStats'

describe('useStats', () => {
  it('returns empty stats when students is empty', () => {
    const { result } = renderHook(() => useStats([], []))
    expect(result.current.totalStudents).toBe(0)
    expect(result.current.popularCourses).toEqual([])
  })

  it('computes gender counts', () => {
    const students = [
      { name: 'A', gender: '男', age: 65 },
      { name: 'B', gender: '女', age: 70 },
      { name: 'C', gender: '男', age: 55 },
    ]
    const { result } = renderHook(() => useStats(students, []))
    expect(result.current.males).toBe(2)
    expect(result.current.females).toBe(1)
  })

  it('computes age groups', () => {
    const students = [
      { name: 'A', age: 45 },
      { name: 'B', age: 65 },
      { name: 'C', age: null },
    ]
    const { result } = renderHook(() => useStats(students, []))
    expect(result.current.ageGroups['50歲以下']).toBe(1)
    expect(result.current.ageGroups['60-69歲']).toBe(1)
    expect(result.current.ageGroups['未知']).toBe(1)
  })

  it('computes popular courses excluding refunded', () => {
    const students = [{ name: 'A' }]
    const enrollments = [
      { refunded: false, courses: ['肌力訓練', '北歐健走'] },
      { refunded: true, courses: ['肌力訓練'] },
      { refunded: false, courses: ['肌力訓練'] },
    ]
    const { result } = renderHook(() => useStats(students, enrollments))
    expect(result.current.popularCourses[0]).toEqual({ name: '肌力訓練', count: 2 })
    expect(result.current.popularCourses[1]).toEqual({ name: '北歐健走', count: 1 })
  })
})
```

- [ ] **Step 2: Run useStats tests**

Run: `cd dashboard && npx vitest run src/hooks/useStats.test.js`
Expected: All PASS

- [ ] **Step 3: Create `useExportHandler.js` with test**

Create `dashboard/src/hooks/useExportHandler.js`:
```js
import { useCallback } from 'react'
import { exportToExcel } from '../lib/excelExport'

export default function useExportHandler(students, enrollments) {
  return useCallback(({ exportScope, selectedSeason, options }) => {
    let exportStudents = students
    let exportEnrollments = enrollments

    if (exportScope === 'season') {
      exportEnrollments = enrollments.filter(e => e.season === selectedSeason)
      const enrolledIds = new Set(exportEnrollments.map(e => String(e.student_id)))
      exportStudents = students.filter(s => enrolledIds.has(String(s.student_id)))
    }

    const courseCounts = {}
    exportEnrollments.forEach(e => {
      if (!e.refunded) {
        e.courses.forEach(c => {
          courseCounts[c] = (courseCounts[c] || 0) + 1
        })
      }
    })
    const exportCourses = Object.entries(courseCounts)
      .map(([name, count]) => ({ Course: name, Count: count }))
      .sort((a, b) => b.Count - a.Count)

    const filename = exportScope === 'season' ? `YMCA_export_${selectedSeason}.xlsx` : 'YMCA_export_all.xlsx'

    exportToExcel(exportStudents, exportEnrollments, exportCourses, filename, options)
  }, [students, enrollments])
}
```

Create `dashboard/src/hooks/useExportHandler.test.js`:
```js
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/excelExport', () => ({ exportToExcel: vi.fn() }))

import useExportHandler from './useExportHandler'
import { exportToExcel } from '../lib/excelExport'

describe('useExportHandler', () => {
  it('calls exportToExcel with all data when scope is "all"', () => {
    const students = [{ student_id: '1', name: 'A' }]
    const enrollments = [{ student_id: '1', season: '第十五季', refunded: false, courses: ['肌力訓練'] }]

    const { result } = renderHook(() => useExportHandler(students, enrollments))
    result.current({ exportScope: 'all', selectedSeason: null, options: { summary: true } })

    expect(exportToExcel).toHaveBeenCalledWith(
      students,
      enrollments,
      [{ Course: '肌力訓練', Count: 1 }],
      'YMCA_export_all.xlsx',
      { summary: true }
    )
  })

  it('filters by season when scope is "season"', () => {
    const students = [
      { student_id: '1', name: 'A' },
      { student_id: '2', name: 'B' },
    ]
    const enrollments = [
      { student_id: '1', season: '第十五季', refunded: false, courses: ['肌力訓練'] },
      { student_id: '2', season: '第十六季', refunded: false, courses: ['北歐健走'] },
    ]

    const { result } = renderHook(() => useExportHandler(students, enrollments))
    result.current({ exportScope: 'season', selectedSeason: '第十五季', options: {} })

    expect(exportToExcel).toHaveBeenCalledWith(
      [students[0]],
      [enrollments[0]],
      [{ Course: '肌力訓練', Count: 1 }],
      'YMCA_export_第十五季.xlsx',
      {}
    )
  })
})
```

- [ ] **Step 4: Run useExportHandler tests**

Run: `cd dashboard && npx vitest run src/hooks/useExportHandler.test.js`
Expected: All PASS

- [ ] **Step 5: Create `useStudentSelection.js` with test**

Create `dashboard/src/hooks/useStudentSelection.js`:
```js
import { useState, useEffect, useCallback } from 'react'

export default function useStudentSelection(students) {
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetailInitialTab, setStudentDetailInitialTab] = useState('profile')
  const [studentDetailIsTabbed, setStudentDetailIsTabbed] = useState(true)

  const openStudentDetail = useCallback((student, initialTab = null) => {
    if (initialTab) {
      setStudentDetailInitialTab(initialTab)
      setStudentDetailIsTabbed(true)
    } else {
      setStudentDetailInitialTab(null)
      setStudentDetailIsTabbed(false)
    }
    setSelectedStudent(student)
  }, [])

  const closeStudentDetail = useCallback(() => {
    setSelectedStudent(null)
  }, [])

  useEffect(() => {
    setSelectedStudent(current => {
      if (!current) return current
      return (students || []).find(candidate => String(candidate.student_id) === String(current.student_id)) || current
    })
  }, [students])

  return {
    selectedStudent,
    studentDetailInitialTab,
    studentDetailIsTabbed,
    openStudentDetail,
    closeStudentDetail,
  }
}
```

Create `dashboard/src/hooks/useStudentSelection.test.js`:
```js
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useStudentSelection from './useStudentSelection'

describe('useStudentSelection', () => {
  it('starts with no selected student', () => {
    const { result } = renderHook(() => useStudentSelection([]))
    expect(result.current.selectedStudent).toBeNull()
  })

  it('opens a student in tabbed mode when initialTab is provided', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student, 'profile'))

    expect(result.current.selectedStudent).toEqual(student)
    expect(result.current.studentDetailInitialTab).toBe('profile')
    expect(result.current.studentDetailIsTabbed).toBe(true)
  })

  it('opens a student in stacked mode when initialTab is null', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student))

    expect(result.current.selectedStudent).toEqual(student)
    expect(result.current.studentDetailIsTabbed).toBe(false)
  })

  it('closes the student detail', () => {
    const student = { student_id: '1', name: 'A' }
    const { result } = renderHook(() => useStudentSelection([student]))

    act(() => result.current.openStudentDetail(student, 'profile'))
    act(() => result.current.closeStudentDetail())

    expect(result.current.selectedStudent).toBeNull()
  })

  it('syncs selected student when students list updates', () => {
    const original = { student_id: '1', name: '王小明' }
    const refreshed = { student_id: '1', name: '王大明' }
    const { result, rerender } = renderHook(
      ({ students }) => useStudentSelection(students),
      { initialProps: { students: [original] } }
    )

    act(() => result.current.openStudentDetail(original, 'profile'))
    expect(result.current.selectedStudent.name).toBe('王小明')

    rerender({ students: [refreshed] })
    expect(result.current.selectedStudent.name).toBe('王大明')
  })
})
```

- [ ] **Step 6: Run useStudentSelection tests**

Run: `cd dashboard && npx vitest run src/hooks/useStudentSelection.test.js`
Expected: All PASS

- [ ] **Step 7: Refactor App.jsx to use the new hooks**

Replace the imports and `AuthenticatedDashboard` function in `dashboard/src/App.jsx`. The key changes:

1. Add imports for the three new hooks, remove `useMemo`, `useEffect` (keep `useState`), remove `normalizeEducation` and `exportToExcel` imports
2. Replace the `stats` useMemo block (lines 43-95) with `const stats = useStats(students, enrollments)`
3. Replace the export handler inline code (lines 253-281) with `handleExport` from `useExportHandler`
4. Replace student selection state and functions (lines 28-31, 98-114) with destructured `useStudentSelection`
5. Replace `onClose={() => setSelectedStudent(null)}` with `onClose={closeStudentDetail}`

The updated imports section:
```js
import { useState, useEffect } from 'react'
import './App.css'
import { FileSpreadsheet, RefreshCw, Download, Activity, Users, Calendar, AlertCircle, LogOut, ShieldCheck } from 'lucide-react'

import useApiData from './hooks/useApiData'
import useStats from './hooks/useStats'
import useExportHandler from './hooks/useExportHandler'
import useStudentSelection from './hooks/useStudentSelection'
import OverviewTab from './components/overview/OverviewTab'
import StudentListTab from './components/students/StudentListTab'
import EnrollmentTab from './components/enrollment/EnrollmentTab'
import StudentDetailModal from './components/students/StudentDetailModal'
import AddStudentModal from './components/students/AddStudentModal'
import AddEnrollModal from './components/enrollment/AddEnrollModal'
import ExcelSync from './components/sync/ExcelSync'
import ExportOptionsDialog from './components/sync/ExportOptionsDialog'
import Login from './components/auth/Login'
import PasswordSetup from './components/auth/PasswordSetup'
import AdminAccountPage from './components/admin/AdminAccountPage'
import { useAuth } from './contexts/AuthContext'
import usePermissions from './hooks/usePermissions'
```

The updated `AuthenticatedDashboard` state section:
```js
function AuthenticatedDashboard() {
  const { session, user, role, signOut } = useAuth()
  const permissions = usePermissions(role)
  const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '檢視者' }
  const ROLE_COLORS = { admin: '#ef4444', editor: '#3b82f6', viewer: '#6b7280' }
  const [activeTab, setActiveTab] = useState('overview')
  const [showAddStudentModal, setShowAddStudentModal] = useState(false)
  const [showAddEnrollModal, setShowAddEnrollModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)

  useEffect(() => {
    if (role !== 'admin' && activeTab === 'admin') setActiveTab('overview')
  }, [role, activeTab])

  const { dbData, dbStatus, dbError } = useApiData(session, refreshCount)
  const { students, enrollments } = dbData

  const stats = useStats(students, enrollments)
  const handleExport = useExportHandler(students, enrollments)
  const {
    selectedStudent, studentDetailInitialTab, studentDetailIsTabbed,
    openStudentDetail, closeStudentDetail
  } = useStudentSelection(students)

  const handleRefresh = () => setRefreshCount(c => c + 1)
  // ... rest of JSX unchanged, except:
  // - onClose={() => setSelectedStudent(null)} → onClose={closeStudentDetail}
  // - ExportOptionsDialog onExport callback → onExport={handleExport} (with setShowExportModal(false) kept outside)
```

For the ExportOptionsDialog, wrap `handleExport` to also close the modal:
```jsx
      {showExportModal && (
        <ExportOptionsDialog
          enrollments={enrollments}
          onCancel={() => setShowExportModal(false)}
          onExport={(params) => {
            setShowExportModal(false)
            handleExport(params)
          }}
        />
      )}
```

- [ ] **Step 8: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS (existing App.test.jsx tests verify behavior is unchanged)

- [ ] **Step 9: Commit**

```bash
git add dashboard/src/hooks/useStats.js dashboard/src/hooks/useStats.test.js dashboard/src/hooks/useExportHandler.js dashboard/src/hooks/useExportHandler.test.js dashboard/src/hooks/useStudentSelection.js dashboard/src/hooks/useStudentSelection.test.js dashboard/src/App.jsx
git commit -m "refactor: extract useStats, useExportHandler, useStudentSelection from App.jsx"
```

---

### Task 5: Extract AppHeader component

**Files:**
- Create: `dashboard/src/components/common/AppHeader.jsx`
- Modify: `dashboard/src/App.jsx` (lines 122-169)

**Interfaces:**
- Consumes: `ExcelSync` component, lucide icons
- Produces: `<AppHeader>` component with props: `dbStatus`, `permissions`, `user`, `role`, `onRefresh`, `onShowExportModal`, `onSignOut`, `children` (for ExcelSync slot)

- [ ] **Step 1: Create `AppHeader.jsx`**

Create `dashboard/src/components/common/AppHeader.jsx`:
```jsx
import { FileSpreadsheet, RefreshCw, Download, LogOut } from 'lucide-react'

const ROLE_LABELS = { admin: '管理員', editor: '編輯者', viewer: '檢視者' }
const ROLE_COLORS = { admin: '#ef4444', editor: '#3b82f6', viewer: '#6b7280' }

export default function AppHeader({ dbStatus, permissions, user, role, onRefresh, onShowExportModal, onSignOut, syncSlot }) {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="header-title-area">
          <FileSpreadsheet size={32} className="header-icon" />
          <div>
            <h1 className="header-title">學員個人資料聯絡簿</h1>
            <p className="header-subtitle">資訊整理與智慧查詢系統</p>
          </div>
          <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
            <span className={`status-dot ${dbStatus === 'connected' ? 'dot-glowing-green' : (dbStatus === 'connecting' ? 'dot-orange' : 'dot-grey')}`}></span>
            <span style={{ fontSize: '12px', marginLeft: '6px', fontWeight: '500', color: dbStatus === 'connected' ? '#10b981' : '#9ca3af' }}>
              {dbStatus === 'connected' ? 'Supabase 資料庫已連線' : (dbStatus === 'connecting' ? '資料庫連線中...' : '離線模式 (載入靜態備份)')}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {syncSlot}
          {permissions.canRefreshSync && dbStatus === 'connected' && (
            <button
              type="button"
              className="btn-secondary"
              style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
              onClick={onRefresh}
            >
              <RefreshCw size={14} className={dbStatus === 'connecting' ? 'spin' : ''} />
              <span>整理同步</span>
            </button>
          )}
          <button
            className="btn-primary"
            id="btn-download-excel"
            onClick={onShowExportModal}
          >
            <Download size={18} />
            <span>下載整理版 Excel</span>
          </button>
          <div className="header-user-info">
            <span className="header-user-email">{user?.email}</span>
            <span className="header-role-badge" style={{ backgroundColor: ROLE_COLORS[role] || '#6b7280' }}>
              {ROLE_LABELS[role] || '檢視者'}
            </span>
            <button type="button" className="btn-logout" onClick={onSignOut} title="登出">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Update App.jsx to use AppHeader**

Add import:
```js
import AppHeader from './components/common/AppHeader'
```

Remove `ROLE_LABELS`, `ROLE_COLORS` constants and the `FileSpreadsheet, RefreshCw, Download, LogOut` imports (keep `Activity, Users, Calendar, AlertCircle, ShieldCheck`).

Replace the `<header>...</header>` block with:
```jsx
        <AppHeader
          dbStatus={dbStatus}
          permissions={permissions}
          user={user}
          role={role}
          onRefresh={handleRefresh}
          onShowExportModal={() => setShowExportModal(true)}
          onSignOut={signOut}
          syncSlot={permissions.canSyncExcel ? <ExcelSync onSyncComplete={handleRefresh} /> : null}
        />
```

- [ ] **Step 3: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/common/AppHeader.jsx dashboard/src/App.jsx
git commit -m "refactor: extract AppHeader component from App.jsx"
```

---

### Task 6: Split App.css into component-scoped files

**Files:**
- Modify: `dashboard/src/App.css` (reduce from 1717 to ~180 lines)
- Create: `dashboard/src/components/overview/OverviewTab.css`
- Create: `dashboard/src/components/students/students.css`
- Create: `dashboard/src/components/enrollment/enrollment.css`
- Create: `dashboard/src/components/sync/sync.css`
- Create: `dashboard/src/components/admin/admin.css`
- Create: `dashboard/src/components/common/common.css`
- Create: `dashboard/src/components/auth/auth.css`
- Modify: Each component's entry file to add CSS import

Based on the App.css section map:

| CSS Sections (lines) | Target File |
|---|---|
| 1-12 (Main Layout), 13-137 (Header), 138-179 (Tabs Nav), 180-188 (Main Wrapper), 947-956 (Footer), 957-1001 (Status Dot), 1002-1014 (Offline Banner) | `App.css` (keep) |
| 189-266 (KPI Panel), 267-298 (Charts/Overview), 299-470 (Donut Chart), 1648-1717 (Seniors Metric) | `components/overview/OverviewTab.css` |
| 471-554 (Search Filters), 555-624 (Data Table), 625-654 (Badges), 655-698 (Pagination), 699-786 (Student Detail Modal), 787-821 (Detail Info Grid), 1513-1559 (Edit mode buttons) | `components/students/students.css` |
| 822-946 (Timeline), 1621-1635 (Enrollment edit form) | `components/enrollment/enrollment.css` |
| 1015-1039 (SQL Console), 1040-1067 (SQL Textarea), 1068-1101 (SQL Alert), 1102-1149 (SQL Schema), 1150-1168 (SQL Template) | `components/sync/sync.css` |
| 1560-1589 (Admin), 1590-1620 (Timeline action buttons) | `components/admin/admin.css` |
| 1169-1512 (Form Modals) | `components/common/common.css` |
| 1636-1647 (Password setup) | `components/auth/auth.css` |

- [ ] **Step 1: Create all CSS files by moving sections from App.css**

Move each section block (cut from App.css, paste into the target file). Keep App.css with only the layout, header, tabs, main wrapper, footer, status dot, and offline banner sections.

- [ ] **Step 2: Add CSS imports to each component**

Add to each component's main file:
- `OverviewTab.jsx`: `import './OverviewTab.css'`
- `StudentListTab.jsx`: `import './students.css'`
- `StudentDetailModal.jsx`: `import './students.css'` (if not already imported by StudentListTab in same bundle — Vite deduplicates, so importing in both is fine)
- `EnrollmentTab.jsx`: `import './enrollment.css'`
- `ExcelSync.jsx`: `import './sync.css'`
- `AdminAccountPage.jsx`: `import './admin.css'`
- `AddStudentModal.jsx`: `import '../common/common.css'`
- `PasswordSetup.jsx`: `import './auth.css'`

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npm run build`
Expected: Build succeeds with no CSS errors

- [ ] **Step 4: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/App.css dashboard/src/components/
git commit -m "refactor: split App.css into component-scoped CSS files"
```

---

### Task 7: Split OverviewTab into sub-components

**Files:**
- Create: `dashboard/src/components/overview/KpiCards.jsx`
- Create: `dashboard/src/components/overview/AgeDistributionChart.jsx`
- Create: `dashboard/src/components/overview/CoursePopularityChart.jsx`
- Modify: `dashboard/src/components/overview/OverviewTab.jsx`

**Interfaces:**
- Consumes: `stats` object from `useStats`
- Produces:
  - `<KpiCards stats={stats} />`
  - `<AgeDistributionChart ageGroups={stats.ageGroups} />`
  - `<CoursePopularityChart popularCourses={stats.popularCourses} />`

- [ ] **Step 1: Create KpiCards.jsx**

Extract lines 100-132 of `OverviewTab.jsx` (the `{/* KPI Section */}` block) into `KpiCards.jsx`. Props: `stats`.

```jsx
import { Users, BookOpen, DollarSign } from 'lucide-react'

export default function KpiCards({ stats }) {
  return (
    <div className="kpi-grid">
      <div className="kpi-card">
        <div className="kpi-icon-wrapper purple"><Users size={24} /></div>
        <div>
          <div className="kpi-label">累計服務學員</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalStudents ?? 0}</span>
            <span className="kpi-unit">人</span>
          </div>
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper emerald"><BookOpen size={24} /></div>
        <div>
          <div className="kpi-label">累計選課總人次</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRegistrations ?? 0}</span>
            <span className="kpi-unit">人次</span>
          </div>
        </div>
      </div>
      <div className="kpi-card">
        <div className="kpi-icon-wrapper amber"><DollarSign size={24} /></div>
        <div>
          <div className="kpi-label">累計退費記錄</div>
          <div className="kpi-value-area">
            <span className="kpi-value">{stats?.totalRefunds ?? 0}</span>
            <span className="kpi-unit">人次</span>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AgeDistributionChart.jsx**

Extract lines 19-50 (slice calculation) and lines 136-228 (the age chart SVG + legend) into a new component. Props: `ageGroups`.

- [ ] **Step 3: Create CoursePopularityChart.jsx**

Extract lines 62-94 (courseSlice calculation) and lines 230-325 (course chart + education panel + seniors panel) into a new component. Props: `popularCourses`, `eduCounts`, `totalStudents`, `students`.

- [ ] **Step 4: Simplify OverviewTab.jsx to compose sub-components**

```jsx
import './OverviewTab.css'
import KpiCards from './KpiCards'
import AgeDistributionChart from './AgeDistributionChart'
import CoursePopularityChart from './CoursePopularityChart'

export default function OverviewTab({ students, stats = {} }) {
  return (
    <div>
      <KpiCards stats={stats} />
      <div className="overview-grid">
        <AgeDistributionChart ageGroups={stats?.ageGroups} />
        <CoursePopularityChart
          popularCourses={stats?.popularCourses}
          eduCounts={stats?.eduCounts}
          totalStudents={stats?.totalStudents}
          students={students}
        />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run existing OverviewTab tests**

Run: `cd dashboard && npx vitest run src/components/overview/OverviewTab.test.jsx`
Expected: All tests PASS (behavior unchanged)

- [ ] **Step 6: Run full test suite**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/components/overview/
git commit -m "refactor: split OverviewTab into KpiCards, AgeDistributionChart, CoursePopularityChart"
```

---

### Task 8: Split StudentListTab into sub-components

**Files:**
- Create: `dashboard/src/components/students/StudentFilters.jsx`
- Create: `dashboard/src/components/students/StudentTable.jsx`
- Modify: `dashboard/src/components/students/StudentListTab.jsx`

**Interfaces:**
- `<StudentFilters>` Props: `studentSearch`, `onSearchChange`, `studentGenderFilter`, `onGenderChange`, `studentAgeFilter`, `onAgeChange`, `studentEduFilter`, `onEduChange`
- `<StudentTable>` Props: `students` (paginated), `enrollments`, `sortOrder`, `onToggleSort`, `onSelectStudent`, `page`, `totalPages`, `onPageChange`

- [ ] **Step 1: Create StudentFilters.jsx**

Extract the filters panel JSX (search input + dropdown filters) into its own component. All filter state stays in `StudentListTab`; `StudentFilters` receives values and change handlers as props.

- [ ] **Step 2: Create StudentTable.jsx**

Extract the data table + pagination JSX into its own component. Receives pre-paginated students, sort controls, and page navigation as props.

- [ ] **Step 3: Simplify StudentListTab.jsx**

Keep all state and `useMemo` computations in `StudentListTab`. Compose:
```jsx
<StudentFilters ... />
<StudentTable ... />
```

- [ ] **Step 4: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/students/
git commit -m "refactor: split StudentListTab into StudentFilters and StudentTable"
```

---

### Task 9: Extract useUnsavedChangesGuard hook from StudentDetailModal

**Files:**
- Create: `dashboard/src/hooks/useUnsavedChangesGuard.js`
- Create: `dashboard/src/hooks/useUnsavedChangesGuard.test.js`
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`

**Interfaces:**
- Produces: `useUnsavedChangesGuard() → { hasUnsavedChanges, setHasUnsavedChanges, pendingAction, requestAction(action), confirmPendingAction(), cancelPendingAction() }`

- [ ] **Step 1: Write failing test**

Create `dashboard/src/hooks/useUnsavedChangesGuard.test.js`:
```js
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import useUnsavedChangesGuard from './useUnsavedChangesGuard'

describe('useUnsavedChangesGuard', () => {
  it('executes action immediately when no unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.requestAction(() => { executed = true }))

    expect(executed).toBe(true)
    expect(result.current.pendingAction).toBeNull()
  })

  it('blocks action and sets pending when there are unsaved changes', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => { executed = true }))

    expect(executed).toBe(false)
    expect(result.current.pendingAction).not.toBeNull()
  })

  it('executes pending action on confirm', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())
    let executed = false

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => { executed = true }))
    act(() => result.current.confirmPendingAction())

    expect(executed).toBe(true)
    expect(result.current.pendingAction).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(false)
  })

  it('clears pending action on cancel', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard())

    act(() => result.current.setHasUnsavedChanges(true))
    act(() => result.current.requestAction(() => {}))
    act(() => result.current.cancelPendingAction())

    expect(result.current.pendingAction).toBeNull()
    expect(result.current.hasUnsavedChanges).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd dashboard && npx vitest run src/hooks/useUnsavedChangesGuard.test.js`
Expected: FAIL

- [ ] **Step 3: Implement the hook**

Create `dashboard/src/hooks/useUnsavedChangesGuard.js`:
```js
import { useState, useCallback } from 'react'

export default function useUnsavedChangesGuard() {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const requestAction = useCallback((action) => {
    if (!hasUnsavedChanges) {
      action()
    } else {
      setPendingAction(() => action)
    }
  }, [hasUnsavedChanges])

  const confirmPendingAction = useCallback(() => {
    if (pendingAction) {
      pendingAction()
      setPendingAction(null)
      setHasUnsavedChanges(false)
    }
  }, [pendingAction])

  const cancelPendingAction = useCallback(() => {
    setPendingAction(null)
  }, [])

  return {
    hasUnsavedChanges,
    setHasUnsavedChanges,
    pendingAction,
    requestAction,
    confirmPendingAction,
    cancelPendingAction,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd dashboard && npx vitest run src/hooks/useUnsavedChangesGuard.test.js`
Expected: All PASS

- [ ] **Step 5: Integrate into StudentDetailModal.jsx**

Replace the manual `hasUnsavedStudentChanges` / `pendingAction` state management in `StudentDetailModal.jsx` with the new hook. Verify tab-switching and close protection logic still works.

- [ ] **Step 6: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add dashboard/src/hooks/useUnsavedChangesGuard.js dashboard/src/hooks/useUnsavedChangesGuard.test.js dashboard/src/components/students/StudentDetailModal.jsx
git commit -m "refactor: extract useUnsavedChangesGuard hook from StudentDetailModal"
```
