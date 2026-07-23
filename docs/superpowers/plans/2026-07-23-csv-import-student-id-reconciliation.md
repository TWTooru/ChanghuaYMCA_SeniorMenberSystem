# CSV Import Student ID Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow safe numeric student-ID edits and make blank-ID CSV rows update one strictly matched student or receive a new numeric ID.

**Architecture:** Shared frontend domain helpers normalize IDs and build strict identity keys, while preview classification remains read-only and preserves the original payload. PostgreSQL is authoritative: a migration adds update-cascading foreign keys, database-side ID enforcement, an atomic student-profile RPC, and transaction-safe CSV reconciliation.

**Tech Stack:** React 19, Vitest, Testing Library, Supabase JS, PostgreSQL PL/pgSQL, pgTAP, Vite

## Global Constraints

- General student editing, manual student creation, and nonblank CSV IDs accept only integers greater than `0`.
- Normalize leading zeros without converting IDs through JavaScript `Number`; `0012` becomes `12`.
- Blank CSV IDs remain valid and activate identity matching.
- A blank CSV ID matches an existing student only when trimmed name, trimmed gender, and normalized birth date are all present and all equal.
- Mobile phone does not participate in blank-ID matching.
- Zero matches create a new max-plus-one numeric ID; one match updates that student; two or more matches block and roll back the whole import.
- Duplicate strict identities among blank-ID rows in one CSV block the import.
- CSV blank student fields preserve existing database student values after a match.
- Changing an ID to an existing ID must be rejected with `學員編號已存在`; students are never merged.
- Existing nonnumeric IDs may keep their ID while other profile fields change, but any changed ID must become a positive integer.
- Preview classification must not rewrite a blank `provided_student_id`; PostgreSQL repeats all matching at commit time.
- `enrollments.student_id` must use `ON UPDATE CASCADE ON DELETE CASCADE`.
- All new RPCs use `security definer`, `set search_path = ''`, explicit grants, and `current_app_role()` authorization.
- Any database error rolls back the complete import.
- Do not modify or commit the user's unrelated `supabase/functions/admin-users/*` or `supabase/.temp/*` changes.
- Do not apply the linked migration until `supabase db push --dry-run` lists only the migration created by this plan and the user explicitly approves the linked database change.

---

## File Structure

- Create `dashboard/src/domain/studentIdentity.js`: shared string-safe ID normalization, identity-date normalization, and strict identity-key construction.
- Create `dashboard/src/domain/studentIdentity.test.js`: focused domain behavior.
- Modify `dashboard/src/domain/quarterCsvImport.js`: validate and normalize supplied IDs; detect duplicate blank-ID identities with the strict key.
- Modify `dashboard/src/domain/quarterCsvImport.test.js`: parser regression coverage.
- Modify `dashboard/src/services/importPreviewService.js`: resolve zero/one/many snapshot matches without changing payload IDs.
- Modify `dashboard/src/services/importPreviewService.test.js`: classification, effective enrollment ID, and ambiguity coverage.
- Modify `dashboard/src/components/sync/ImportPreviewDialog.jsx`: display student insert/update counts and blank-ID resolutions.
- Modify `dashboard/src/components/sync/ImportPreviewDialog.test.jsx`: preview presentation coverage.
- Modify `dashboard/src/services/dataImportService.js`: map authoritative RPC errors to user-facing Chinese.
- Modify `dashboard/src/services/dataImportService.test.js`: import error mapping coverage.
- Create `supabase/migrations/20260723120000_student_id_reconciliation.sql`: cascading FK, validation trigger, atomic profile RPC, and revised import RPC.
- Create `supabase/tests/database/student_id_reconciliation_test.sql`: pgTAP coverage for profile-ID changes and CSV reconciliation.
- Modify `dashboard/src/services/studentService.js`: call the profile RPC and map student-ID errors.
- Modify `dashboard/src/services/studentService.test.js`: RPC contract and error mapping.
- Modify `dashboard/src/components/students/StudentEditForm.jsx`: editable ID, validation, confirmation, and updated-student callback.
- Modify `dashboard/src/components/students/StudentDetailForms.test.jsx`: form behavior.
- Modify `dashboard/src/components/students/StudentDetailModal.jsx`: propagate the updated student.
- Modify `dashboard/src/components/students/StudentDetailComponents.test.jsx`: modal propagation behavior.
- Modify `dashboard/src/hooks/useStudentSelection.js`: replace the current selected student after an ID change.
- Modify `dashboard/src/hooks/useStudentSelection.test.js`: selection replacement coverage.
- Modify `dashboard/src/App.jsx`: connect updated-student propagation.
- Modify `dashboard/src/App.test.jsx`: App integration coverage.
- Modify `dashboard/src/components/students/AddStudentModal.jsx`: positive-integer normalization for manual creation.
- Create `dashboard/src/components/students/AddStudentModal.test.jsx`: manual-create validation coverage.

### Task 1: Shared Student ID and Strict Identity Domain Rules

**Files:**

- Create: `dashboard/src/domain/studentIdentity.js`
- Create: `dashboard/src/domain/studentIdentity.test.js`
- Modify: `dashboard/src/domain/quarterCsvImport.js:1-124`
- Test: `dashboard/src/domain/quarterCsvImport.test.js:1-93`

**Interfaces:**

- Produces: `normalizeStudentId(value, { allowBlank?: boolean }): string | null`
- Produces: `normalizeIdentityDate(value): string`
- Produces: `buildStudentIdentityKey(student): string | null`
- Produces: `STUDENT_ID_VALIDATION_MESSAGE`
- Consumed later by preview classification and both student forms.

- [ ] **Step 1: Write failing shared-domain tests**

Create `dashboard/src/domain/studentIdentity.test.js`:

```js
import { describe, expect, it } from 'vitest'
import {
  STUDENT_ID_VALIDATION_MESSAGE,
  buildStudentIdentityKey,
  normalizeIdentityDate,
  normalizeStudentId,
} from './studentIdentity'

describe('student identity domain', () => {
  it('normalizes positive integer IDs without Number coercion', () => {
    expect(normalizeStudentId(' 0012 ')).toBe('12')
    expect(normalizeStudentId('900719925474099312345')).toBe('900719925474099312345')
    expect(normalizeStudentId('', { allowBlank: true })).toBeNull()
  })

  it.each(['', '0', '000', '-1', '1.5', 'A12', '12A'])(
    'rejects invalid student ID %s',
    value => {
      expect(() => normalizeStudentId(value)).toThrow(STUDENT_ID_VALIDATION_MESSAGE)
    }
  )

  it('requires name, gender, and birth date for a strict identity key', () => {
    expect(buildStudentIdentityKey({
      name: ' 王小明 ',
      gender: ' 男 ',
      birth_date: '1960-1-2',
      mobile_phone: '0912345678',
    })).toBe(JSON.stringify(['王小明', '男', '1960/01/02']))
    expect(buildStudentIdentityKey({ name: '王小明', gender: '', birth_date: '1960/01/02' })).toBeNull()
    expect(buildStudentIdentityKey({ name: '王小明', gender: '男', birth_date: '' })).toBeNull()
  })

  it('normalizes supported stored date separators', () => {
    expect(normalizeIdentityDate('1960-1-2')).toBe('1960/01/02')
    expect(normalizeIdentityDate('1960/01/02')).toBe('1960/01/02')
    expect(normalizeIdentityDate('1960/02/30')).toBe('')
  })
})
```

- [ ] **Step 2: Add failing parser tests**

Append to `quarterCsvImport.test.js`:

```js
  it('normalizes supplied IDs and rejects invalid nonblank IDs', () => {
    const parsed = parseQuarterCsvRows([
      { 學員編號: '0012', 姓名: '甲', 性別: '男', 出生日期: '1960/1/2', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: 'A12', 姓名: '乙', 性別: '女', 出生日期: '1961/1/2', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
    ], { headers })

    expect(parsed.rows[0].provided_student_id).toBe('12')
    expect(parsed.errors).toContainEqual({
      row: 3,
      field: '學員編號',
      message: '學員編號必須是大於 0 的整數',
    })
  })

  it('blocks duplicate blank-ID rows only when all three identity fields match', () => {
    const parsed = parseQuarterCsvRows([
      { 學員編號: '', 姓名: '王小明', 性別: '男', 出生日期: '1960/1/2', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: '', 姓名: ' 王小明 ', 性別: '男', 出生日期: '1960-01-02', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
      { 學員編號: '', 姓名: '王小明', 性別: '女', 出生日期: '1960/1/2', '第16季前測': '', '第16季後測': '', '第16季(新、續)': '', 課程1: '' },
    ], { headers })

    expect(parsed.errors.filter(error => error.field === '學員編號')).toEqual([
      { row: 3, field: '學員編號', message: '疑似重複學生，請先核對來源第 2 列' },
    ])
  })
```

Replace the existing phone-based duplicate fixture in the last parser test so both duplicate blank-ID rows include the same `性別` and `出生日期`. Remove the assertion that phone equality alone creates a duplicate.

- [ ] **Step 3: Run tests and verify RED**

Run from `dashboard`:

```powershell
npm test -- --run src/domain/studentIdentity.test.js src/domain/quarterCsvImport.test.js
```

Expected: FAIL because `studentIdentity.js` does not exist and the parser still accepts `A12`.

- [ ] **Step 4: Implement the shared domain module**

Create `dashboard/src/domain/studentIdentity.js`:

```js
export const STUDENT_ID_VALIDATION_MESSAGE = '學員編號必須是大於 0 的整數'

export function normalizeStudentId(value, { allowBlank = false } = {}) {
  const text = String(value ?? '').trim()
  if (!text && allowBlank) return null
  if (!/^\d+$/.test(text)) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)

  const normalized = text.replace(/^0+/, '')
  if (!normalized) throw new Error(STUDENT_ID_VALIDATION_MESSAGE)
  return normalized
}

export function normalizeIdentityDate(value) {
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (!match) return ''

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return ''

  return `${String(year).padStart(4, '0')}/${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`
}

export function buildStudentIdentityKey(student) {
  const name = String(student?.name ?? '').trim()
  const gender = String(student?.gender ?? '').trim()
  const birthDate = normalizeIdentityDate(student?.birth_date)
  if (!name || !gender || !birthDate) return null
  return JSON.stringify([name, gender, birthDate])
}
```

- [ ] **Step 5: Integrate the helpers into the CSV parser**

In `quarterCsvImport.js`, add:

```js
import {
  buildStudentIdentityKey,
  normalizeStudentId,
} from './studentIdentity'
```

Delete `normalizeName`, `normalizePhone`, and `sameIdentity`. Replace `const seenIds = new Set()` and `const newRows = []` with:

```js
  const seenIds = new Set()
  const blankIdentityRows = new Map()
```

Replace the supplied-ID read with:

```js
    let providedStudentId = null
    try {
      providedStudentId = normalizeStudentId(row['學員編號'], { allowBlank: true })
    } catch (error) {
      errors.push({ row: sourceRow, field: '學員編號', message: error.message })
    }
```

Replace the blank-ID duplicate branch with:

```js
    if (providedStudentId) {
      if (seenIds.has(providedStudentId)) {
        errors.push({ row: sourceRow, field: '學員編號', message: `檔案內重複編號 ${providedStudentId}` })
      }
      seenIds.add(providedStudentId)
    } else {
      const identityKey = buildStudentIdentityKey(student)
      const firstRow = identityKey ? blankIdentityRows.get(identityKey) : null
      if (firstRow) {
        errors.push({
          row: sourceRow,
          field: '學員編號',
          message: `疑似重複學生，請先核對來源第 ${firstRow} 列`,
        })
      } else if (identityKey) {
        blankIdentityRows.set(identityKey, sourceRow)
      }
    }
```

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- --run src/domain/studentIdentity.test.js src/domain/quarterCsvImport.test.js src/domain/quarterCsvImport.acceptance.test.js
```

Expected: all focused domain tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- dashboard/src/domain/studentIdentity.js dashboard/src/domain/studentIdentity.test.js dashboard/src/domain/quarterCsvImport.js dashboard/src/domain/quarterCsvImport.test.js
git commit -m "feat(import): normalize student IDs and strict identities"
```

### Task 2: Import Preview Reconciliation and Presentation

**Files:**

- Modify: `dashboard/src/services/importPreviewService.js:1-108`
- Test: `dashboard/src/services/importPreviewService.test.js:1-207`
- Modify: `dashboard/src/components/sync/ImportPreviewDialog.jsx:17-136`
- Test: `dashboard/src/components/sync/ImportPreviewDialog.test.jsx:1-132`

**Interfaces:**

- Consumes: `buildStudentIdentityKey(student)`.
- Produces: `preview.studentResolutions: Array<{ sourceRow, studentName, action: 'update' | 'insert', studentId: string | null }>`
- Preserves: `preview.payload.rows[*].provided_student_id` exactly as parsed; blank IDs remain `null`.

- [ ] **Step 1: Write failing preview-service tests**

Change the test helper to include gender:

```js
const row = (id, name, birth, mobile = null, gender = '男') => ({
  source_row: 2,
  provided_student_id: id,
  student: { name, gender, birth_date: birth, mobile_phone: mobile },
  enrollments: [{ season: '第十六季', reg_type: '續', pre_test: null, post_test: null, courses: ['肌力'] }]
})
```

Replace the old blank-ID suspected-duplicate test and add the following:

```js
  it('resolves one strict blank-ID match as an update without rewriting payload', () => {
    const parsed = {
      mode: 'single-season',
      seasons: ['第十六季'],
      rows: [row(null, '王小明', '1960/01/01', null, '男')],
      warnings: [],
      errors: [],
    }
    const preview = classifyImport(parsed, {
      students: [{ student_id: '12', name: '王小明', gender: '男', birth_date: '1960-01-01' }],
      enrollments: [{ student_id: '12', season: '第十六季' }],
      tableCounts: { students: 1, enrollments: 1, courses: 0 },
    })

    expect(preview.hasBlockingErrors).toBe(false)
    expect(preview.summary).toMatchObject({
      oldStudents: 1,
      newStudents: 0,
      enrollmentsToInsert: 0,
      enrollmentsToUpdate: 1,
    })
    expect(preview.studentResolutions).toEqual([
      { sourceRow: 2, studentName: '王小明', action: 'update', studentId: '12' },
    ])
    expect(preview.payload.rows[0].provided_student_id).toBeNull()
  })

  it('classifies an incomplete strict identity as a new student', () => {
    const parsed = {
      rows: [row(null, '王小明', '1960/01/01', '0912345678', '')],
      warnings: [],
      errors: [],
    }
    const preview = classifyImport(parsed, {
      students: [{ student_id: '12', name: '王小明', gender: '男', birth_date: '1960/01/01', mobile_phone: '0912345678' }],
      enrollments: [],
      tableCounts: { students: 1, enrollments: 0, courses: 0 },
    })

    expect(preview.hasBlockingErrors).toBe(false)
    expect(preview.summary).toMatchObject({ oldStudents: 0, newStudents: 1 })
    expect(preview.studentResolutions[0]).toMatchObject({ action: 'insert', studentId: null })
  })

  it('blocks when a strict identity matches multiple database students', () => {
    const parsed = {
      rows: [row(null, '重複姓名', '1960/01/01', null, '女')],
      warnings: [],
      errors: [],
    }
    const preview = classifyImport(parsed, {
      students: [
        { student_id: '12', name: '重複姓名', gender: '女', birth_date: '1960/01/01' },
        { student_id: '13', name: '重複姓名', gender: '女', birth_date: '1960-01-01' },
      ],
      enrollments: [],
      tableCounts: { students: 2, enrollments: 0, courses: 0 },
    })

    expect(preview.hasBlockingErrors).toBe(true)
    expect(preview.errors).toContainEqual({
      row: 2,
      field: '學員編號',
      message: '姓名、性別、出生日期符合多筆資料，請先整理資料庫',
    })
  })
```

Update existing snapshot fixtures that are intended to match `row(...)` so
they include `gender: '男'`. In particular, change the historical-date test
snapshot to:

```js
students: [{
  student_id: '12',
  name: '王小明',
  gender: '男',
  birth_date: '1960-01-01',
  mobile_phone: null,
}],
```

and change its expectation from a blocking duplicate to:

```js
expect(preview.hasBlockingErrors).toBe(false)
expect(preview.summary).toMatchObject({
  oldStudents: 1,
  newStudents: 0,
  targetSeason: '第十六季',
  preTestsCleared: 1,
  postTestsCleared: 1,
})
```

- [ ] **Step 2: Write failing dialog tests**

Extend the valid preview fixture with:

```js
studentResolutions: [
  { sourceRow: 2, studentName: '王小明', action: 'update', studentId: '12' },
  { sourceRow: 3, studentName: '陳美麗', action: 'insert', studentId: null },
],
```

Add assertions:

```js
expect(screen.getByText('更新學員 1 位')).not.toBeNull()
expect(screen.getByText('新增學員 1 位')).not.toBeNull()
expect(screen.getByText('來源第 2 列：王小明 → 更新學員 12')).not.toBeNull()
expect(screen.getByText('來源第 3 列：陳美麗 → 新增並自動指派編號')).not.toBeNull()
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npm test -- --run src/services/importPreviewService.test.js src/components/sync/ImportPreviewDialog.test.jsx
```

Expected: FAIL because blank IDs are still blocked as suspected duplicates and `studentResolutions` is absent.

- [ ] **Step 4: Replace preview classification with strict reconciliation**

Import the helper:

```js
import { buildStudentIdentityKey } from '../domain/studentIdentity'
```

Delete `normalizeName`, `normalizePhone`, `normalizeStoredDate`, and `suspectedDuplicate`. Replace `classifyImport` with:

```js
export function classifyImport(parsed, snapshot) {
  const errors = [...(parsed.errors || [])]
  const warnings = [...(parsed.warnings || [])]
  const addError = error => {
    const duplicate = errors.some(existing =>
      existing.row === error.row
      && existing.field === error.field
      && existing.message === error.message
    )
    if (!duplicate) errors.push(error)
  }

  const studentsById = new Map(snapshot.students.map(student => [String(student.student_id), student]))
  const studentsByIdentity = new Map()
  for (const student of snapshot.students) {
    const key = buildStudentIdentityKey(student)
    if (!key) continue
    const matches = studentsByIdentity.get(key) || []
    matches.push(student)
    studentsByIdentity.set(key, matches)
  }

  const existingEnrollmentKeys = new Set(snapshot.enrollments.map(enrollmentKey))
  const seenEffectiveIds = new Map()
  const seenBlankIdentities = new Map()
  const studentResolutions = []
  let oldStudents = 0
  let newStudents = 0
  let enrollmentsToInsert = 0
  let enrollmentsToUpdate = 0
  let courses = 0
  let preTestsCleared = 0
  let postTestsCleared = 0

  for (const row of parsed.rows) {
    const suppliedId = row.provided_student_id
    let effectiveId = suppliedId
    let classificationValid = true

    if (suppliedId) {
      if (studentsById.has(suppliedId)) oldStudents += 1
      else newStudents += 1
    } else {
      const identityKey = buildStudentIdentityKey(row.student)
      const firstRow = identityKey ? seenBlankIdentities.get(identityKey) : null
      if (firstRow) {
        addError({
          row: row.source_row,
          field: '學員編號',
          message: `疑似重複學生，請先核對來源第 ${firstRow} 列`,
        })
        classificationValid = false
      } else if (identityKey) {
        seenBlankIdentities.set(identityKey, row.source_row)
      }

      const matches = identityKey ? (studentsByIdentity.get(identityKey) || []) : []
      if (matches.length > 1) {
        addError({
          row: row.source_row,
          field: '學員編號',
          message: '姓名、性別、出生日期符合多筆資料，請先整理資料庫',
        })
        classificationValid = false
      } else if (matches.length === 1) {
        effectiveId = String(matches[0].student_id)
        if (classificationValid) {
          oldStudents += 1
          studentResolutions.push({
            sourceRow: row.source_row,
            studentName: row.student.name,
            action: 'update',
            studentId: effectiveId,
          })
        }
      } else if (classificationValid) {
        newStudents += 1
        studentResolutions.push({
          sourceRow: row.source_row,
          studentName: row.student.name,
          action: 'insert',
          studentId: null,
        })
      }
    }

    if (classificationValid && effectiveId) {
      const firstRow = seenEffectiveIds.get(effectiveId)
      if (firstRow) {
        addError({
          row: row.source_row,
          field: '學員編號',
          message: `檔案內重複編號 ${effectiveId}`,
        })
        classificationValid = false
      } else {
        seenEffectiveIds.set(effectiveId, row.source_row)
      }
    }

    for (const enrollment of row.enrollments) {
      const key = classificationValid && effectiveId
        ? `${effectiveId}\u0000${enrollment.season}`
        : null
      if (key && existingEnrollmentKeys.has(key)) enrollmentsToUpdate += 1
      else enrollmentsToInsert += 1
      courses += enrollment.courses.length
      if (enrollment.pre_test === null) preTestsCleared += 1
      if (enrollment.post_test === null) postTestsCleared += 1
    }
  }

  const tableCounts = snapshot.tableCounts
  if (tableCounts.students || tableCounts.enrollments || tableCounts.courses) {
    warnings.push({ row: null, field: '資料庫', message: 'Supabase 目前不是空資料庫，請確認新增與更新筆數' })
  }
  const importedSeasons = new Set(parsed.rows.flatMap(row => row.enrollments.map(enrollment => enrollment.season)))
  const hasExistingTargetSeason = snapshot.enrollments.some(enrollment => importedSeasons.has(enrollment.season))
  if (hasExistingTargetSeason) {
    warnings.push({ row: null, field: '報名', message: '目標季度已有資料，請確認新增、更新與課程取代筆數' })
  }

  return {
    ...parsed,
    payload: { mode: parsed.mode, rows: parsed.rows },
    studentResolutions,
    summary: {
      fileRows: parsed.rows.length,
      oldStudents,
      newStudents,
      enrollmentsToInsert,
      enrollmentsToUpdate,
      courses,
      targetSeason: parsed.seasons?.[0] || null,
      preTestsCleared,
      postTestsCleared,
      currentStudents: tableCounts.students,
      currentEnrollments: tableCounts.enrollments,
      currentCourses: tableCounts.courses,
    },
    warnings,
    errors,
    hasBlockingErrors: errors.length > 0,
  }
}
```

Keep `enrollmentKey`, `SNAPSHOT_PAGE_SIZE`, `loadAllRows`, and `loadImportPreview` unchanged.

- [ ] **Step 5: Render reconciliation results**

In `ImportPreviewDialog`, read:

```js
const {
  summary,
  studentResolutions = [],
  warnings = [],
  errors = [],
  hasBlockingErrors,
} = preview
```

Add these two list items before enrollment counts:

```jsx
<li style={{ fontSize: '14px' }}>更新學員 {summary.oldStudents} 位</li>
<li style={{ fontSize: '14px' }}>新增學員 {summary.newStudents} 位</li>
```

Add after the import-summary section:

```jsx
{studentResolutions.length > 0 && (
  <section className="form-group full-width" aria-label="空白學員編號解析">
    <h3 style={{ fontSize: '15px', fontWeight: '700', margin: '8px 0 4px' }}>
      空白學員編號解析
    </h3>
    <ul style={{ margin: 0, paddingLeft: '20px' }}>
      {studentResolutions.map(resolution => (
        <li key={resolution.sourceRow} style={{ fontSize: '14px' }}>
          {resolution.action === 'update'
            ? `來源第 ${resolution.sourceRow} 列：${resolution.studentName} → 更新學員 ${resolution.studentId}`
            : `來源第 ${resolution.sourceRow} 列：${resolution.studentName} → 新增並自動指派編號`}
        </li>
      ))}
    </ul>
  </section>
)}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- --run src/services/importPreviewService.test.js src/components/sync/ImportPreviewDialog.test.jsx
```

Expected: all focused preview tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- dashboard/src/services/importPreviewService.js dashboard/src/services/importPreviewService.test.js dashboard/src/components/sync/ImportPreviewDialog.jsx dashboard/src/components/sync/ImportPreviewDialog.test.jsx
git commit -m "feat(import): preview blank-ID reconciliation"
```

### Task 3: Database Integrity, Atomic Profile Update, and Authoritative Import Matching

**Files:**

- Create: `supabase/migrations/20260723120000_student_id_reconciliation.sql`
- Create: `supabase/tests/database/student_id_reconciliation_test.sql`
- Reference: `supabase/migrations/20260717120000_allow_provided_student_id_upsert.sql`

**Interfaces:**

- Produces: `public.normalize_student_id(text) returns text`
- Produces: `public.update_student_profile(p_original_id text, p_student jsonb) returns jsonb`
- Replaces: `public.import_season_data(p_payload jsonb) returns jsonb`
- Preserves: existing import return keys and adds no payload trust for preview-resolved IDs.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/database/student_id_reconciliation_test.sql`:

```sql
begin;
select plan(21);
truncate table public.students cascade;
select set_config('request.jwt.claims', '{"app_metadata":{"app_role":"editor"}}', true);

insert into public.students (student_id, name, gender, birth_date)
values ('10', '改號學員', '男', '1960/01/01');
insert into public.enrollments (student_id, season, reg_type)
values ('10', '第十六季', '續');
insert into public.courses (enrollment_id, course_name)
select enrollment_id, '肌力' from public.enrollments where student_id = '10';

select is(
  public.update_student_profile(
    '10',
    '{"student_id":"0020","name":"改號學員","gender":"男","birth_date":"1960-01-01"}'::jsonb
  ) ->> 'student_id',
  '20',
  'profile RPC normalizes and returns the new student ID'
);
select is(
  (select student_id from public.enrollments where season = '第十六季'),
  '20',
  'student ID update cascades to enrollments'
);
select is(
  (select count(*)::integer from public.courses where course_name = '肌力'),
  1,
  'student ID update preserves courses'
);

insert into public.students (student_id, name) values ('30', '既有目標');
select throws_ok(
  $$select public.update_student_profile('20', '{"student_id":"30","name":"改號學員"}'::jsonb)$$,
  'P0001',
  'STUDENT_ID_EXISTS',
  'profile RPC rejects an existing target ID'
);
select is(
  (select count(*)::integer from public.students where student_id = '20'),
  1,
  'duplicate target failure preserves the original student'
);

alter table public.students disable trigger user;
insert into public.students (student_id, name) values ('S-001', '舊格式學員');
alter table public.students enable trigger user;
select is(
  public.update_student_profile('S-001', '{"student_id":"S-001","name":"舊格式更新"}'::jsonb) ->> 'name',
  '舊格式更新',
  'unchanged legacy ID can update other profile fields'
);
select throws_ok(
  $$select public.update_student_profile('S-001', '{"student_id":"S-002","name":"舊格式更新"}'::jsonb)$$,
  'P0001',
  'INVALID_STUDENT_ID',
  'changed legacy ID must become numeric'
);
select is(
  public.update_student_profile('S-001', '{"student_id":"0040","name":"舊格式更新"}'::jsonb) ->> 'student_id',
  '40',
  'legacy ID can be changed to a normalized numeric ID'
);
select throws_ok(
  $$insert into public.students (student_id, name) values ('ABC', '非法新增')$$,
  'P0001',
  'INVALID_STUDENT_ID',
  'new students require numeric IDs'
);

insert into public.students (student_id, name, gender, birth_date)
values ('50', '王小明', '男', '1960/01/01');
select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":2,"provided_student_id":null,"student":{"name":"王小明","gender":"男","birth_date":"1960/01/01","mobile_phone":"0912-000-000"},"enrollments":[{"season":"第十六季","reg_type":"續","pre_test":null,"post_test":null,"courses":["攝影"]}]}]}'::jsonb)$$,
  'blank ID uniquely matches an existing student'
);
select is(
  (select mobile_phone from public.students where student_id = '50'),
  '0912-000-000',
  'matched blank-ID row updates the existing student'
);
select is(
  (select count(*)::integer from public.students),
  4,
  'matched blank-ID row does not add a student'
);
select is(
  (select student_id from public.enrollments where student_id = '50' and season = '第十六季'),
  '50',
  'matched blank-ID enrollment uses the existing student ID'
);

select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":3,"provided_student_id":null,"student":{"name":"缺性別新生","birth_date":"1962/02/02"},"enrollments":[]} ]}'::jsonb)$$,
  'incomplete strict identity creates a new student'
);
select is(
  (select student_id from public.students where name = '缺性別新生'),
  '51',
  'new blank-ID row receives max numeric ID plus one'
);

insert into public.students (student_id, name, gender, birth_date)
values
  ('60', '重複身分', '女', '1965/03/04'),
  ('61', '重複身分', '女', '1965-03-04');
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":4,"provided_student_id":null,"student":{"name":"重複身分","gender":"女","birth_date":"1965/03/04"},"enrollments":[]}]}'::jsonb)$$,
  'P0001',
  'ROW_4:AMBIGUOUS_STUDENT_MATCH',
  'multiple database matches roll back the import'
);
select throws_ok(
  $$select public.import_season_data('{"rows":[
    {"source_row":2,"provided_student_id":null,"student":{"name":"檔案重複","gender":"男","birth_date":"1970/04/05"},"enrollments":[]},
    {"source_row":3,"provided_student_id":null,"student":{"name":"檔案重複","gender":"男","birth_date":"1970/04/05"},"enrollments":[]}
  ]}'::jsonb)$$,
  'P0001',
  'ROW_3:DUPLICATE_IMPORT_IDENTITY:2',
  'duplicate blank-ID identities in one file roll back'
);

select lives_ok(
  $$select public.import_season_data('{"rows":[{"source_row":5,"provided_student_id":"0070","student":{"name":"指定編號","gender":"男","birth_date":"1970/01/01"},"enrollments":[]}]}'::jsonb)$$,
  'supplied ID with leading zeros is normalized'
);
select is(
  (select count(*)::integer from public.students where student_id = '70'),
  1,
  'normalized supplied ID is stored canonically'
);
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":6,"provided_student_id":"A70","student":{"name":"非法指定","gender":"男","birth_date":"1970/01/01"},"enrollments":[]}]}'::jsonb)$$,
  'P0001',
  'ROW_6:INVALID_STUDENT_ID',
  'nonnumeric supplied ID is rejected'
);
select throws_ok(
  $$select public.import_season_data('{"rows":[{"source_row":7,"provided_student_id":"0","student":{"name":"零編號","gender":"男","birth_date":"1970/01/01"},"enrollments":[]}]}'::jsonb)$$,
  'P0001',
  'ROW_7:INVALID_STUDENT_ID',
  'zero supplied ID is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run the new database test and verify RED**

Run from the repository root:

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/student_id_reconciliation_test.sql
```

Expected: FAIL because `public.update_student_profile` does not exist and current blank-ID imports raise `POSSIBLE_DUPLICATE_STUDENT`.

- [ ] **Step 3: Add cascading FK and database ID enforcement**

Start `20260723120000_student_id_reconciliation.sql` with:

```sql
alter table public.enrollments
  drop constraint if exists enrollments_student_id_fkey;

alter table public.enrollments
  add constraint enrollments_student_id_fkey
  foreign key (student_id)
  references public.students(student_id)
  on update cascade
  on delete cascade;

create or replace function public.normalize_student_id(p_value text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_text text := pg_catalog.btrim(coalesce(p_value, ''));
begin
  if v_text !~ '^\d+$' then
    raise exception 'INVALID_STUDENT_ID';
  end if;
  v_text := pg_catalog.regexp_replace(v_text, '^0+', '');
  if v_text = '' then
    raise exception 'INVALID_STUDENT_ID';
  end if;
  return v_text;
end;
$$;

create or replace function public.enforce_student_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if exists (
      select 1 from public.students s where s.student_id = new.student_id
    ) then
      return new;
    end if;
    new.student_id := public.normalize_student_id(new.student_id);
  elsif new.student_id is distinct from old.student_id then
    new.student_id := public.normalize_student_id(new.student_id);
  end if;
  return new;
end;
$$;

drop trigger if exists students_enforce_student_id on public.students;
create trigger students_enforce_student_id
before insert or update of student_id on public.students
for each row execute function public.enforce_student_id();
```

The existing-row exception in the insert trigger is required so `INSERT ... ON CONFLICT DO UPDATE` can update an unchanged legacy nonnumeric ID.

- [ ] **Step 4: Add the atomic profile RPC**

Append:

```sql
create or replace function public.update_student_profile(
  p_original_id text,
  p_student jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current public.students%rowtype;
  v_updated public.students%rowtype;
  v_requested_id text;
  v_new_id text;
  v_name text;
  v_birth_text text;
  v_birth_date date;
  v_age integer;
  v_sixty_plus text;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'STUDENT_UPDATE_FORBIDDEN' using errcode = '42501';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.student_identity_mutation')
  );

  select * into v_current
  from public.students
  where student_id = p_original_id
  for update;
  if not found then
    raise exception 'STUDENT_NOT_FOUND';
  end if;

  v_requested_id := pg_catalog.btrim(coalesce(p_student ->> 'student_id', ''));
  if v_requested_id = p_original_id then
    v_new_id := p_original_id;
  else
    v_new_id := public.normalize_student_id(v_requested_id);
  end if;

  if v_new_id <> p_original_id and exists (
    select 1 from public.students where student_id = v_new_id
  ) then
    raise exception 'STUDENT_ID_EXISTS';
  end if;

  v_name := nullif(pg_catalog.btrim(p_student ->> 'name'), '');
  if v_name is null then
    raise exception 'NAME_REQUIRED';
  end if;

  v_birth_text := nullif(
    pg_catalog.replace(pg_catalog.btrim(p_student ->> 'birth_date'), '-', '/'),
    ''
  );
  v_birth_date := null;
  v_age := null;
  v_sixty_plus := null;
  if v_birth_text is not null then
    if v_birth_text !~ '^\d{4}/\d{2}/\d{2}$'
       or pg_catalog.to_char(
         pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD'),
         'YYYY/MM/DD'
       ) <> v_birth_text then
      raise exception 'INVALID_BIRTH_DATE';
    end if;
    v_birth_date := pg_catalog.to_date(v_birth_text, 'YYYY/MM/DD');
    v_age := extract(year from pg_catalog.age(current_date, v_birth_date))::integer;
    v_sixty_plus := case when v_age >= 60 then '是' else '否' end;
  end if;

  update public.students
  set
    student_id = v_new_id,
    name = v_name,
    gender = nullif(pg_catalog.btrim(p_student ->> 'gender'), ''),
    birth_date = v_birth_text,
    age = v_age,
    is_60_plus = v_sixty_plus,
    address = nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
    home_phone = nullif(pg_catalog.btrim(p_student ->> 'home_phone'), ''),
    mobile_phone = nullif(pg_catalog.btrim(p_student ->> 'mobile_phone'), ''),
    emergency_contact = nullif(pg_catalog.btrim(p_student ->> 'emergency_contact'), ''),
    relationship = nullif(pg_catalog.btrim(p_student ->> 'relationship'), ''),
    emergency_contact_phone = nullif(pg_catalog.btrim(p_student ->> 'emergency_contact_phone'), ''),
    education = nullif(pg_catalog.btrim(p_student ->> 'education'), ''),
    occupation = nullif(pg_catalog.btrim(p_student ->> 'occupation'), '')
  where student_id = p_original_id
  returning * into v_updated;

  return pg_catalog.to_jsonb(v_updated);
end;
$$;

revoke all on function public.update_student_profile(text, jsonb) from public;
grant execute on function public.update_student_profile(text, jsonb) to authenticated;
```

- [ ] **Step 5: Restate and revise the import RPC**

Copy the complete latest `public.import_season_data(jsonb)` definition, revoke, and grant from `20260717120000_allow_provided_student_id_upsert.sql` into the new migration after the profile RPC.

In its declaration block, use:

```sql
  v_row jsonb; v_student jsonb; v_enrollment jsonb;
  v_raw_provided_id text; v_provided_id text; v_student_id text;
  v_enrollment_id public.enrollments.enrollment_id%type;
  v_next_id numeric; v_source_row integer; v_course_count integer;
  v_students_inserted integer := 0; v_students_updated integer := 0;
  v_enrollments_inserted integer := 0; v_enrollments_updated integer := 0;
  v_courses_written integer := 0; v_exists boolean;
  v_assigned jsonb := '[]'::jsonb;
  v_seen_effective_ids text[] := array[]::text[];
  v_seen_identities text[] := array[]::text[];
  v_seen_identity_rows integer[] := array[]::integer[];
  v_identity_key text; v_identity_index integer;
  v_match_count integer; v_matched_id text;
  v_name text; v_gender text;
  v_birth_text text; v_birth_date date; v_age integer; v_sixty_plus text;
  v_pre_test text; v_post_test text; v_reg_type text;
```

Use the same advisory lock as the profile RPC and calculate the next ID without `bigint` overflow:

```sql
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('public.student_identity_mutation')
  );
  select coalesce(max(student_id::numeric), 0) into v_next_id
  from public.students
  where student_id ~ '^\d+$';
```

At the start of each row, normalize student values and the optional supplied ID:

```sql
    v_source_row := coalesce((v_row ->> 'source_row')::integer, 0);
    v_student := v_row -> 'student';
    v_name := nullif(pg_catalog.btrim(v_student ->> 'name'), '');
    v_gender := nullif(pg_catalog.btrim(v_student ->> 'gender'), '');
    if v_name is null then
      raise exception 'ROW_%:NAME_REQUIRED', v_source_row;
    end if;

    v_raw_provided_id := nullif(
      pg_catalog.btrim(v_row ->> 'provided_student_id'),
      ''
    );
    v_provided_id := null;
    if v_raw_provided_id is not null then
      begin
        v_provided_id := public.normalize_student_id(v_raw_provided_id);
      exception when others then
        raise exception 'ROW_%:INVALID_STUDENT_ID', v_source_row;
      end;
    end if;
```

Keep the current birth-date validation and age calculation, then replace the current supplied/blank-ID branch with:

```sql
    if v_provided_id is not null then
      select exists(
        select 1 from public.students where student_id = v_provided_id
      ) into v_exists;
      v_student_id := v_provided_id;
      if v_exists then
        v_students_updated := v_students_updated + 1;
      else
        v_students_inserted := v_students_inserted + 1;
        v_next_id := greatest(v_next_id, v_provided_id::numeric);
      end if;
    else
      v_identity_key := null;
      if v_name is not null and v_gender is not null and v_birth_text is not null then
        v_identity_key := pg_catalog.jsonb_build_array(
          v_name,
          v_gender,
          v_birth_text
        )::text;
      end if;

      if v_identity_key is not null then
        v_identity_index := pg_catalog.array_position(
          v_seen_identities,
          v_identity_key
        );
        if v_identity_index is not null then
          raise exception 'ROW_%:DUPLICATE_IMPORT_IDENTITY:%',
            v_source_row,
            v_seen_identity_rows[v_identity_index];
        end if;
        v_seen_identities := pg_catalog.array_append(
          v_seen_identities,
          v_identity_key
        );
        v_seen_identity_rows := pg_catalog.array_append(
          v_seen_identity_rows,
          v_source_row
        );

        select count(*)::integer, min(s.student_id)
        into v_match_count, v_matched_id
        from public.students s
        where pg_catalog.btrim(s.name) = v_name
          and pg_catalog.btrim(coalesce(s.gender, '')) = v_gender
          and s.birth_date is not null
          and s.birth_date::text ~ '^\d{4}[-/]\d{1,2}[-/]\d{1,2}$'
          and pg_catalog.to_char(
            pg_catalog.to_date(
              pg_catalog.replace(s.birth_date::text, '-', '/'),
              'YYYY/MM/DD'
            ),
            'YYYY/MM/DD'
          ) = v_birth_text;
      else
        v_match_count := 0;
        v_matched_id := null;
      end if;

      if v_match_count > 1 then
        raise exception 'ROW_%:AMBIGUOUS_STUDENT_MATCH', v_source_row;
      elsif v_match_count = 1 then
        v_student_id := v_matched_id;
        v_exists := true;
        v_students_updated := v_students_updated + 1;
      else
        v_next_id := v_next_id + 1;
        v_student_id := v_next_id::text;
        v_exists := false;
        v_students_inserted := v_students_inserted + 1;
        v_assigned := v_assigned || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'source_row', v_source_row,
            'student_id', v_student_id
          )
        );
      end if;
    end if;

    if v_student_id = any(v_seen_effective_ids) then
      raise exception 'ROW_%:DUPLICATE_STUDENT_ID:%',
        v_source_row,
        v_student_id;
    end if;
    v_seen_effective_ids := pg_catalog.array_append(
      v_seen_effective_ids,
      v_student_id
    );
```

Keep the current student upsert, blank-field preservation, enrollment validation/upsert, course replacement, return object, revoke, and authenticated grant byte-for-byte. The insert trigger's existing-row exception allows this upsert to update an unchanged legacy ID.

- [ ] **Step 6: Verify migration dry-run before any linked write**

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' db push --dry-run
```

Expected:

```text
Would push these migrations:
 • 20260723120000_student_id_reconciliation.sql
```

If any other migration is listed, stop and reconcile migration history. Ask the user for explicit approval before Step 7 because it mutates the linked Supabase database.

- [ ] **Step 7: Apply the approved migration**

After explicit user approval:

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' db push --yes
```

Expected: `Applying migration 20260723120000_student_id_reconciliation.sql...` and exit code `0`.

- [ ] **Step 8: Run database tests and verify GREEN**

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/student_id_reconciliation_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/seasonal_import_test.sql
```

Expected: 21 new reconciliation assertions PASS and all 31 existing seasonal-import assertions PASS.

- [ ] **Step 9: Commit**

```powershell
git add -- supabase/migrations/20260723120000_student_id_reconciliation.sql supabase/tests/database/student_id_reconciliation_test.sql
git commit -m "feat(db): reconcile student IDs atomically"
```

### Task 4: Student and Import Service Contracts

**Files:**

- Modify: `dashboard/src/services/studentService.js:1-18`
- Test: `dashboard/src/services/studentService.test.js:1-111`
- Modify: `dashboard/src/services/dataImportService.js:1-38`
- Test: `dashboard/src/services/dataImportService.test.js:1-89`

**Interfaces:**

- Produces: `updateStudent(client, originalStudentId, payload): Promise<object>`
- Produces: `mapStudentMutationError(error): Error`
- Produces: `mapImportError(error): Error`

- [ ] **Step 1: Replace student-service tests with RPC expectations**

Update the `updateStudent` tests and add mapping tests:

```js
  it('updates a complete student profile through the atomic RPC', async () => {
    const updated = { student_id: '12', name: '王小明' }
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: updated, error: null }),
    }

    await expect(updateStudent(client, 'S-001', updated)).resolves.toEqual(updated)
    expect(client.rpc).toHaveBeenCalledWith('update_student_profile', {
      p_original_id: 'S-001',
      p_student: updated,
    })
  })

  it.each([
    ['STUDENT_ID_EXISTS', '學員編號已存在'],
    ['INVALID_STUDENT_ID', '學員編號必須是大於 0 的整數'],
    ['STUDENT_NOT_FOUND', '找不到要更新的學員，請重新整理'],
  ])('maps %s to a user-facing message', async (databaseMessage, expected) => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: databaseMessage },
      }),
    }

    await expect(updateStudent(client, '1', { student_id: '2', name: '甲' }))
      .rejects.toThrow(expected)
  })
```

Update `createStudent`'s duplicate-ID test so `{ message: 'duplicate key value violates unique constraint "students_pkey"' }` maps to `學員編號已存在`.

- [ ] **Step 2: Add failing import error-mapping tests**

Append to `dataImportService.test.js`:

```js
  it.each([
    ['ROW_4:INVALID_STUDENT_ID', '第 4 列：學員編號必須是大於 0 的整數'],
    ['ROW_5:AMBIGUOUS_STUDENT_MATCH', '第 5 列：姓名、性別、出生日期符合多筆資料，請先整理資料庫'],
    ['ROW_3:DUPLICATE_IMPORT_IDENTITY:2', '第 3 列：疑似重複學生，請先核對來源第 2 列'],
  ])('maps import RPC error %s', async (databaseMessage, expected) => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { message: databaseMessage },
      }),
    }

    await expect(commitImport({
      hasBlockingErrors: false,
      payload: { mode: 'single-season', rows: [] },
    }, client)).rejects.toThrow(expected)
  })
```

- [ ] **Step 3: Run tests and verify RED**

```powershell
npm test -- --run src/services/studentService.test.js src/services/dataImportService.test.js
```

Expected: FAIL because `updateStudent` still calls `.from().update()` and database messages are not mapped.

- [ ] **Step 4: Implement service mappings**

Replace `studentService.js` with:

```js
const STUDENT_ERROR_MESSAGES = [
  ['STUDENT_ID_EXISTS', '學員編號已存在'],
  ['students_pkey', '學員編號已存在'],
  ['INVALID_STUDENT_ID', '學員編號必須是大於 0 的整數'],
  ['STUDENT_NOT_FOUND', '找不到要更新的學員，請重新整理'],
]

export function mapStudentMutationError(error) {
  const message = error?.message || String(error || '')
  const match = STUDENT_ERROR_MESSAGES.find(([code]) => message.includes(code))
  return match ? new Error(match[1]) : error
}

export async function createStudent(client, studentData) {
  const { error } = await client.from('students').insert([studentData])
  if (error) throw mapStudentMutationError(error)
}

export async function updateStudent(client, studentId, payload) {
  const { data, error } = await client.rpc('update_student_profile', {
    p_original_id: String(studentId),
    p_student: payload,
  })
  if (error) throw mapStudentMutationError(error)
  return data
}

export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
```

In `dataImportService.js`, add:

```js
export function mapImportError(error) {
  const message = error?.message || String(error || '')
  let match = message.match(/ROW_(\d+):INVALID_STUDENT_ID/)
  if (match) return new Error(`第 ${match[1]} 列：學員編號必須是大於 0 的整數`)

  match = message.match(/ROW_(\d+):AMBIGUOUS_STUDENT_MATCH/)
  if (match) {
    return new Error(`第 ${match[1]} 列：姓名、性別、出生日期符合多筆資料，請先整理資料庫`)
  }

  match = message.match(/ROW_(\d+):DUPLICATE_IMPORT_IDENTITY:(\d+)/)
  if (match) {
    return new Error(`第 ${match[1]} 列：疑似重複學生，請先核對來源第 ${match[2]} 列`)
  }
  return error
}
```

Change `commitImport`'s RPC block to:

```js
  const { data, error } = await client.rpc('import_season_data', { p_payload: preview.payload })
  if (error) throw mapImportError(error)
  return data
```

- [ ] **Step 5: Run focused tests and verify GREEN**

```powershell
npm test -- --run src/services/studentService.test.js src/services/dataImportService.test.js
```

Expected: all focused service tests PASS.

- [ ] **Step 6: Commit**

```powershell
git add -- dashboard/src/services/studentService.js dashboard/src/services/studentService.test.js dashboard/src/services/dataImportService.js dashboard/src/services/dataImportService.test.js
git commit -m "feat(services): use atomic student ID contracts"
```

### Task 5: Editable Student ID and Selected-Student Synchronization

**Files:**

- Modify: `dashboard/src/components/students/StudentEditForm.jsx:1-68`
- Test: `dashboard/src/components/students/StudentDetailForms.test.jsx:1-65`
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Test: `dashboard/src/components/students/StudentDetailComponents.test.jsx`
- Modify: `dashboard/src/hooks/useStudentSelection.js:1-37`
- Test: `dashboard/src/hooks/useStudentSelection.test.js:1-57`
- Modify: `dashboard/src/App.jsx:43-131`
- Test: `dashboard/src/App.test.jsx:1-169`

**Interfaces:**

- Consumes: `normalizeStudentId`, `updateStudent`.
- Changes: `StudentEditForm.onSave(updatedStudent)`.
- Changes: `StudentDetailModal.onStudentUpdated(updatedStudent)`.
- Produces: `useStudentSelection.replaceSelectedStudent(updatedStudent)`.

- [ ] **Step 1: Mock the service and write failing form tests**

In `StudentDetailForms.test.jsx`, replace the Supabase `.from().update()` mock with:

```js
const updateStudentMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn() } }))
vi.mock('../../services/studentService', () => ({
  updateStudent: updateStudentMock,
}))
```

Reset `updateStudentMock` after each test. Replace the read-only assertion and add:

```js
  it('allows editing a student ID and explains the numeric rule', () => {
    render(<StudentEditForm student={student} onSave={vi.fn()} onCancel={vi.fn()} />)

    const input = screen.getByLabelText('學員編號')
    expect(input.disabled).toBe(false)
    expect(input.getAttribute('inputmode')).toBe('numeric')
    expect(screen.getByText('僅限正整數，前導零會自動移除')).not.toBeNull()
  })

  it('blocks an invalid changed ID before calling the service', async () => {
    render(<StudentEditForm student={student} onSave={vi.fn()} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('學員編號'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))

    expect((await screen.findByRole('alert')).textContent).toContain('學員編號必須是大於 0 的整數')
    expect(updateStudentMock).not.toHaveBeenCalled()
  })

  it('confirms a changed ID and returns the updated student', async () => {
    const onSave = vi.fn()
    const updated = { ...student, student_id: '12' }
    updateStudentMock.mockResolvedValueOnce(updated)
    render(<StudentEditForm student={student} onSave={onSave} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByLabelText('學員編號'), { target: { value: '0012' } })
    fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
    expect(screen.getByText('修改學員編號將同步更新所有報名紀錄')).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '確認修改' }))
    expect(updateStudentMock).toHaveBeenCalledWith(
      expect.anything(),
      'S-001',
      expect.objectContaining({ student_id: '12', name: '王小明' })
    )
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(updated))
  })
```

Replace the existing inline-save-error setup with:

```js
updateStudentMock.mockRejectedValueOnce(new Error('更新失敗'))
```

and keep its assertions that the alert is shown, the form remains mounted,
and `onSave` is not called. Import `waitFor` from Testing Library for the
successful async assertion.

- [ ] **Step 2: Add failing selection and modal propagation tests**

Append to `useStudentSelection.test.js`:

```js
  it('replaces the selected student after an ID change', () => {
    const original = { student_id: 'S-001', name: '王小明' }
    const updated = { student_id: '12', name: '王小明' }
    const { result } = renderHook(() => useStudentSelection([original]))

    act(() => result.current.openStudentDetail(original, 'profile'))
    act(() => result.current.replaceSelectedStudent(updated))

    expect(result.current.selectedStudent).toEqual(updated)
  })
```

In `StudentDetailComponents.test.jsx`, import `waitFor`, add a hoisted
`updateStudentMock`, and mock only the service while continuing to render the
real `StudentEditForm`:

```js
const updateStudentMock = vi.hoisted(() => vi.fn())

vi.mock('../../services/studentService', () => ({
  updateStudent: updateStudentMock,
}))
```

Reset `updateStudentMock` in the existing `afterEach`, then add:

```jsx
it('propagates the updated student returned by the edit form', async () => {
  authState.role = 'admin'
  const onStudentUpdated = vi.fn()
  const updated = { ...student, student_id: '12' }
  updateStudentMock.mockResolvedValueOnce(updated)
  render(
    <StudentDetailModal
      student={student}
      enrollments={[]}
      initialTab="profile"
      onClose={vi.fn()}
      onRefresh={vi.fn()}
      onStudentUpdated={onStudentUpdated}
    />
  )

  fireEvent.click(screen.getByRole('button', { name: /編輯/ }))
  fireEvent.change(screen.getByLabelText('學員編號'), { target: { value: '12' } })
  fireEvent.click(screen.getByRole('button', { name: '儲存變更' }))
  fireEvent.click(screen.getByRole('button', { name: '確認修改' }))

  await waitFor(() => expect(onStudentUpdated).toHaveBeenCalledWith(updated))
})
```

- [ ] **Step 3: Run focused tests and verify RED**

```powershell
npm test -- --run src/components/students/StudentDetailForms.test.jsx src/components/students/StudentDetailComponents.test.jsx src/hooks/useStudentSelection.test.js src/App.test.jsx
```

Expected: FAIL because the ID field is disabled, no confirmation exists, and replacement callbacks are absent.

- [ ] **Step 4: Implement editable form behavior**

Import:

```js
import ConfirmDialog from '../common/ConfirmDialog'
import {
  STUDENT_ID_VALIDATION_MESSAGE,
  normalizeStudentId,
} from '../../domain/studentIdentity'
```

Add state:

```js
const [pendingPayload, setPendingPayload] = useState(null)
```

Build an explicit payload and separate validation from persistence:

```js
const buildPayload = () => {
  const originalId = String(student.student_id)
  const typedId = String(editForm.student_id ?? '').trim()
  const normalizedId = typedId === originalId
    ? originalId
    : normalizeStudentId(typedId)

  return {
    student_id: normalizedId,
    name: String(editForm.name ?? '').trim(),
    gender: editForm.gender || '',
    birth_date: editForm.birth_date || '',
    address: editForm.address || '',
    home_phone: editForm.home_phone || '',
    mobile_phone: editForm.mobile_phone || '',
    emergency_contact: editForm.emergency_contact || '',
    relationship: editForm.relationship || '',
    emergency_contact_phone: editForm.emergency_contact_phone || '',
    education: editForm.education || '',
    occupation: editForm.occupation || '',
  }
}

const persist = async payload => {
  setIsSaving(true)
  setSaveError('')
  try {
    const updatedStudent = await updateStudent(
      supabase,
      student.student_id,
      payload
    )
    setPendingPayload(null)
    onDirtyChange(false)
    onSave(updatedStudent)
  } catch (error) {
    setSaveError(error.message || '學員資料更新失敗')
  } finally {
    setIsSaving(false)
  }
}

const handleSave = () => {
  setSaveError('')
  try {
    const payload = buildPayload()
    if (payload.student_id !== String(student.student_id)) {
      setPendingPayload(payload)
      return
    }
    void persist(payload)
  } catch {
    setSaveError(STUDENT_ID_VALIDATION_MESSAGE)
  }
}
```

Replace the ID field with:

```jsx
<div className="form-group">
  <label className="form-label" htmlFor="student-edit-id">學員編號</label>
  <input
    id="student-edit-id"
    type="text"
    inputMode="numeric"
    className="form-input"
    name="student_id"
    value={editForm.student_id || ''}
    onChange={handleFormChange}
    disabled={isSaving}
  />
  <small>僅限正整數，前導零會自動移除</small>
</div>
```

Render after the form grid:

```jsx
<ConfirmDialog
  isOpen={pendingPayload !== null}
  title="修改學員編號"
  message="修改學員編號將同步更新所有報名紀錄"
  confirmLabel="確認修改"
  cancelLabel="取消"
  tone="warning"
  onConfirm={() => void persist(pendingPayload)}
  onCancel={() => setPendingPayload(null)}
/>
```

Wrap the existing grid and `ConfirmDialog` in a fragment.

- [ ] **Step 5: Propagate the returned student**

In `useStudentSelection.js`, add:

```js
const replaceSelectedStudent = useCallback(updatedStudent => {
  setSelectedStudent(updatedStudent)
}, [])
```

Return it from the hook.

In `StudentDetailModal`, add the `onStudentUpdated` prop and a shared handler:

```js
const handleStudentSaved = updatedStudent => {
  setIsEditing(false)
  setHasUnsavedStudentChanges(false)
  onStudentUpdated?.(updatedStudent)
  onRefresh?.()
}
```

Use `onSave={handleStudentSaved}` in both `StudentEditForm` render paths.

In `App.jsx`, destructure `replaceSelectedStudent` from `useStudentSelection` and pass:

```jsx
onStudentUpdated={replaceSelectedStudent}
```

to `StudentDetailModal`.

Update the App test mock to:

```jsx
vi.mock('./components/students/StudentDetailModal', () => ({
  default: ({ student, onStudentUpdated }) => {
    studentDetailModalSpy(student)
    return (
      <>
        <div data-testid="student-detail-modal">{student.name}</div>
        <button
          type="button"
          onClick={() => onStudentUpdated?.({ ...student, student_id: '12' })}
        >
          complete id change
        </button>
      </>
    )
  },
}))
```

Add:

```jsx
it('replaces the selected student immediately after an ID change', () => {
  const selectedStudent = { student_id: 'S-001', name: '王小明' }
  apiData = {
    dbData: { students: [selectedStudent], enrollments: [] },
    dbStatus: 'connected',
    dbError: null,
  }
  render(<App />)

  fireEvent.click(document.querySelector('#tab-students'))
  fireEvent.click(screen.getByRole('button', { name: 'open first student' }))
  fireEvent.click(screen.getByRole('button', { name: 'complete id change' }))

  expect(studentDetailModalSpy).toHaveBeenLastCalledWith({
    student_id: '12',
    name: '王小明',
  })
})
```

- [ ] **Step 6: Run focused tests and verify GREEN**

```powershell
npm test -- --run src/components/students/StudentDetailForms.test.jsx src/components/students/StudentDetailComponents.test.jsx src/hooks/useStudentSelection.test.js src/App.test.jsx
```

Expected: all focused student-edit and selection tests PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- dashboard/src/components/students/StudentEditForm.jsx dashboard/src/components/students/StudentDetailForms.test.jsx dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/hooks/useStudentSelection.js dashboard/src/hooks/useStudentSelection.test.js dashboard/src/App.jsx dashboard/src/App.test.jsx
git commit -m "feat(students): allow atomic student ID edits"
```

### Task 6: Manual Student Creation Numeric IDs

**Files:**

- Modify: `dashboard/src/components/students/AddStudentModal.jsx:1-151`
- Create: `dashboard/src/components/students/AddStudentModal.test.jsx`

**Interfaces:**

- Consumes: `normalizeStudentId`, `STUDENT_ID_VALIDATION_MESSAGE`, and mapped `createStudent`.
- Preserves: automatic max-plus-one suggestion and existing form fields.

- [ ] **Step 1: Write failing component tests**

Create `AddStudentModal.test.jsx`:

```jsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AddStudentModal from './AddStudentModal'
import { createStudent } from '../../services/studentService'

vi.mock('../../lib/supabaseClient', () => ({ supabase: {} }))
vi.mock('../../services/studentService', () => ({
  createStudent: vi.fn(),
}))

let alertSpy

beforeEach(() => {
  alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  alertSpy.mockRestore()
})

describe('AddStudentModal student ID rules', () => {
  it('normalizes a manually entered student ID before insert', async () => {
    createStudent.mockResolvedValueOnce()
    render(<AddStudentModal students={[]} onClose={vi.fn()} onRefresh={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/學員 ID/), { target: { value: '0012' } })
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '新學員' } })
    fireEvent.click(screen.getByRole('button', { name: '新增學員' }))

    await waitFor(() => expect(createStudent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ student_id: '12', name: '新學員' })
    ))
  })

  it('rejects zero before insert', async () => {
    render(<AddStudentModal students={[]} onClose={vi.fn()} onRefresh={vi.fn()} />)

    fireEvent.change(screen.getByLabelText(/學員 ID/), { target: { value: '0' } })
    fireEvent.change(screen.getByLabelText('姓名 *'), { target: { value: '新學員' } })
    fireEvent.click(screen.getByRole('button', { name: '新增學員' }))

    expect(createStudent).not.toHaveBeenCalled()
    expect(alertSpy).toHaveBeenCalledWith('學員編號必須是大於 0 的整數')
  })

  it('suggests one more than the largest valid numeric ID', () => {
    render(
      <AddStudentModal
        students={[
          { student_id: 'S-001' },
          { student_id: '0009' },
          { student_id: '12' },
        ]}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/學員 ID/).value).toBe('13')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

```powershell
npm test -- --run src/components/students/AddStudentModal.test.jsx
```

Expected: FAIL because `0012` is sent unchanged and `0` passes the current truthy check.

- [ ] **Step 3: Implement string-safe manual ID validation**

Import:

```js
import {
  STUDENT_ID_VALIDATION_MESSAGE,
  normalizeStudentId,
} from '../../domain/studentIdentity'
```

Replace `suggestNextStudentId` with:

```js
const suggestNextStudentId = () => {
  let maximum = 0n
  for (const student of students || []) {
    try {
      const normalized = normalizeStudentId(student.student_id)
      const value = BigInt(normalized)
      if (value > maximum) maximum = value
    } catch {
      // Existing nonnumeric IDs are intentionally ignored.
    }
  }
  return String(maximum + 1n)
}
```

Store the suggested ID as a string. In `handleAddStudentSubmit`, normalize before constructing `bodyData`:

```js
let normalizedStudentId
try {
  normalizedStudentId = normalizeStudentId(newStudent.student_id)
} catch {
  alert(STUDENT_ID_VALIDATION_MESSAGE)
  return
}
if (!String(newStudent.name || '').trim()) {
  alert('學員 ID 與姓名為必填欄位！')
  return
}
```

Set:

```js
student_id: normalizedStudentId,
name: String(newStudent.name).trim(),
```

on `bodyData`, and add `inputMode="numeric"` plus `htmlFor`/`id` attributes to the student-ID and name labels/inputs so the tests use accessible labels.

- [ ] **Step 4: Run focused tests and verify GREEN**

```powershell
npm test -- --run src/components/students/AddStudentModal.test.jsx src/services/studentService.test.js
```

Expected: all manual-create and service tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/AddStudentModal.test.jsx
git commit -m "feat(students): enforce numeric IDs on manual create"
```

### Task 7: Full Verification and Invariant Audit

**Files:**

- Verify only; no source changes expected.

**Interfaces:**

- Consumes: Tasks 1–6.
- Produces: fresh evidence for domain, component, service, database, lint, and build correctness.

- [ ] **Step 1: Run all focused dashboard tests**

```powershell
npm test -- --run src/domain/studentIdentity.test.js src/domain/quarterCsvImport.test.js src/domain/quarterCsvImport.acceptance.test.js src/services/importPreviewService.test.js src/services/dataImportService.test.js src/services/studentService.test.js src/components/sync/ImportPreviewDialog.test.jsx src/components/students/StudentDetailForms.test.jsx src/components/students/StudentDetailComponents.test.jsx src/components/students/AddStudentModal.test.jsx src/hooks/useStudentSelection.test.js src/App.test.jsx
```

Working directory: `dashboard`

Expected: all listed test files PASS with zero failed tests.

- [ ] **Step 2: Run the complete dashboard suite**

```powershell
npm test
```

Working directory: `dashboard`

Expected: all dashboard test files PASS.

- [ ] **Step 3: Run lint**

```powershell
npm run lint
```

Working directory: `dashboard`

Expected: exit code `0`; pre-existing warnings may remain, but no new warning may originate from files changed by this plan.

- [ ] **Step 4: Run the production build**

```powershell
npm run build
```

Working directory: `dashboard`

Expected: Vite exits `0` and produces `dashboard/dist`.

- [ ] **Step 5: Run both database suites**

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/student_id_reconciliation_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/seasonal_import_test.sql
```

Expected: 21 reconciliation assertions and 31 seasonal-import assertions PASS.

- [ ] **Step 6: Verify production invariants**

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' db query --linked @"
select jsonb_build_object(
  'profile_rpc', to_regprocedure('public.update_student_profile(text,jsonb)') is not null,
  'import_rpc', to_regprocedure('public.import_season_data(jsonb)') is not null,
  'fk_update_action', (
    select confupdtype
    from pg_constraint
    where conname = 'enrollments_student_id_fkey'
  ),
  'duplicate_student_seasons', (
    select count(*)
    from (
      select student_id, season
      from public.enrollments
      group by student_id, season
      having count(*) > 1
    ) duplicates
  )
) as verification;
"@
```

Expected:

```json
{
  "profile_rpc": true,
  "import_rpc": true,
  "fk_update_action": "c",
  "duplicate_student_seasons": 0
}
```

- [ ] **Step 7: Audit the final diff**

```powershell
git status --short
git diff --check
git diff --stat
```

Expected:

- No whitespace errors.
- Only files named in this plan are changed by the feature.
- The user's pre-existing `supabase/functions/admin-users/*` and `supabase/.temp/*` changes remain untouched and uncommitted.
