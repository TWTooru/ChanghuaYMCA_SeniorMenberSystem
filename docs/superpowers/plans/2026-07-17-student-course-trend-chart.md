# Student Course Trend Chart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a responsive horizontal bar chart to the student detail modal that ranks a student's course preferences and identifies the seasons in which each course was selected.

**Architecture:** Derive chart rows from the modal's already student-filtered `studentTimeline` with a pure domain helper, then render those rows through a focused React component before the existing enrollment timeline. Use semantic HTML and existing CSS variables; do not add a chart dependency or a database request.

**Tech Stack:** React 19, JavaScript ES modules, CSS, Vitest 4, Testing Library, Vite 8

## Global Constraints

- Execute in an isolated Git worktree because the primary workspace contains unrelated uncommitted changes; integrate the verified commits back into the primary workspace only after tests pass.
- Display the exact title `學生選課趨勢圖`.
- Display every valid course; do not truncate the result to a top-N list.
- Count a course once per season, even if duplicate course rows exist for that enrollment/season.
- Count the same course again when it appears in a different season.
- Exclude every enrollment whose `refunded` value is truthy.
- Display each enrollment's non-empty `season` value as a season badge, sorted with the existing `compareSeasons` helper.
- Display the exact empty-state copy `尚無選課趨勢資料`.
- Do not add third-party chart packages, database tables, RPCs, or network requests.
- Render the chart in both tabbed and non-tabbed student history layouts, before `EnrollmentTimeline`.

---

### Task 1: Course trend aggregation

**Files:**
- Create: `dashboard/src/domain/courseTrend.js`
- Test: `dashboard/src/domain/courseTrend.test.js`

**Interfaces:**
- Consumes: `buildStudentCourseTrend(timeline)`, where `timeline` is an array of `{ enrollment_id, season, refunded, courses }` records.
- Produces: `Array<{ courseName: string, count: number, seasons: string[], percentage: number }>` sorted by descending `count`, then by `courseName`.

- [ ] **Step 1: Write the failing aggregation tests**

Create `dashboard/src/domain/courseTrend.test.js`:

```js
import { describe, expect, it } from 'vitest'
import { buildStudentCourseTrend } from './courseTrend'

describe('buildStudentCourseTrend', () => {
  it('counts each course once per season and lists seasons chronologically', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: '第十五季', refunded: false, courses: ['電腦課', '電腦課', '手機課'] },
      { enrollment_id: 2, season: '第十六季', refunded: false, courses: ['電腦課'] },
      { enrollment_id: 3, season: '第十六季', refunded: false, courses: ['電腦課'] },
    ])

    expect(result).toEqual([
      { courseName: '電腦課', count: 2, seasons: ['第十五季', '第十六季'], percentage: 100 },
      { courseName: '手機課', count: 1, seasons: ['第十五季'], percentage: 50 },
    ])
  })

  it('excludes refunded records and safely handles blank courses and missing seasons', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: null, refunded: false, courses: [' 手機課 ', '   '] },
      { enrollment_id: 2, season: null, refunded: false, courses: ['手機課'] },
      { enrollment_id: 3, season: '第十七季', refunded: true, courses: ['手機課', '瑜伽課'] },
      { enrollment_id: 4, season: '第十八季', refunded: false },
    ])

    expect(result).toEqual([
      { courseName: '手機課', count: 2, seasons: [], percentage: 100 },
    ])
  })

  it('sorts equal counts by course name', () => {
    const result = buildStudentCourseTrend([
      { enrollment_id: 1, season: '第十五季', courses: ['B課', 'A課'] },
    ])

    expect(result.map(item => item.courseName)).toEqual(['A課', 'B課'])
  })
})
```

- [ ] **Step 2: Run the domain test to verify it fails**

Run from `dashboard`:

```powershell
npm test -- src/domain/courseTrend.test.js
```

Expected: FAIL because `./courseTrend` does not exist.

- [ ] **Step 3: Implement the pure aggregation helper**

Create `dashboard/src/domain/courseTrend.js`:

```js
import { compareSeasons } from './season'

export function buildStudentCourseTrend(timeline = []) {
  const trendsByCourse = new Map()

  for (const [index, enrollment] of Array.from(timeline || []).entries()) {
    if (!enrollment || enrollment.refunded) continue

    const season = String(enrollment.season ?? '').trim()
    const enrollmentKey = enrollment.enrollment_id ?? index
    const occurrenceKey = season ? `season:${season}` : `enrollment:${enrollmentKey}`
    const courseNames = new Set(
      (Array.isArray(enrollment.courses) ? enrollment.courses : [])
        .map(course => String(course ?? '').trim())
        .filter(Boolean)
    )

    for (const courseName of courseNames) {
      if (!trendsByCourse.has(courseName)) {
        trendsByCourse.set(courseName, {
          courseName,
          occurrences: new Set(),
          seasons: new Set(),
        })
      }

      const trend = trendsByCourse.get(courseName)
      trend.occurrences.add(occurrenceKey)
      if (season) trend.seasons.add(season)
    }
  }

  const rows = Array.from(trendsByCourse.values())
    .map(trend => ({
      courseName: trend.courseName,
      count: trend.occurrences.size,
      seasons: Array.from(trend.seasons).sort(compareSeasons),
    }))
    .sort((left, right) => right.count - left.count || left.courseName.localeCompare(right.courseName, 'zh-Hant'))

  const maxCount = Math.max(0, ...rows.map(row => row.count))
  return rows.map(row => ({
    ...row,
    percentage: maxCount ? Math.round((row.count / maxCount) * 100) : 0,
  }))
}
```

- [ ] **Step 4: Run the domain test to verify it passes**

Run:

```powershell
npm test -- src/domain/courseTrend.test.js
```

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit the aggregation unit**

```powershell
git add dashboard/src/domain/courseTrend.js dashboard/src/domain/courseTrend.test.js
git commit -m "Add student course trend aggregation"
```

---

### Task 2: Course trend chart component

**Files:**
- Create: `dashboard/src/components/students/StudentCourseTrend.jsx`
- Create: `dashboard/src/components/students/StudentCourseTrend.test.jsx`
- Modify: `dashboard/src/App.css`

**Interfaces:**
- Consumes: `<StudentCourseTrend timeline={studentTimeline} />` and `buildStudentCourseTrend(timeline)` from Task 1.
- Produces: A semantic chart section with `.student-course-trend`, one `.student-course-trend-item` per course, visible count text, proportional bars, season badges, and an empty state.

- [ ] **Step 1: Write the failing component tests**

Create `dashboard/src/components/students/StudentCourseTrend.test.jsx`:

```jsx
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import StudentCourseTrend from './StudentCourseTrend'

describe('StudentCourseTrend', () => {
  afterEach(cleanup)

  it('renders ranked bars, counts, and season badges', () => {
    const { container } = render(
      <StudentCourseTrend
        timeline={[
          { enrollment_id: 1, season: '第十五季', courses: ['電腦課', '手機課'] },
          { enrollment_id: 2, season: '第十六季', courses: ['電腦課'] },
        ]}
      />
    )

    expect(screen.getByRole('heading', { name: '學生選課趨勢圖' })).not.toBeNull()
    expect(screen.getByText('電腦課')).not.toBeNull()
    expect(screen.getByText('2 次')).not.toBeNull()
    expect(screen.getAllByText(/第十[五六]季/)).toHaveLength(2)
    expect(container.querySelector('.student-course-trend-fill').style.width).toBe('100%')
  })

  it('renders the empty state when no valid courses remain', () => {
    render(
      <StudentCourseTrend
        timeline={[{ enrollment_id: 1, season: '第十五季', refunded: true, courses: ['電腦課'] }]}
      />
    )

    expect(screen.getByText('尚無選課趨勢資料')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run the component test to verify it fails**

Run from `dashboard`:

```powershell
npm test -- src/components/students/StudentCourseTrend.test.jsx
```

Expected: FAIL because `./StudentCourseTrend` does not exist.

- [ ] **Step 3: Implement the chart component**

Create `dashboard/src/components/students/StudentCourseTrend.jsx`:

```jsx
import { useMemo } from 'react'
import { buildStudentCourseTrend } from '../../domain/courseTrend'

export default function StudentCourseTrend({ timeline = [] }) {
  const trends = useMemo(() => buildStudentCourseTrend(timeline), [timeline])

  return (
    <section className="student-course-trend" aria-labelledby="student-course-trend-title">
      <h3 className="student-course-trend-title" id="student-course-trend-title">
        學生選課趨勢圖
      </h3>

      {trends.length > 0 ? (
        <div className="student-course-trend-list">
          {trends.map(trend => (
            <article
              className="student-course-trend-item"
              key={trend.courseName}
              aria-label={`${trend.courseName}，${trend.count} 次${trend.seasons.length ? `，季度：${trend.seasons.join('、')}` : ''}`}
            >
              <span className="student-course-trend-name">{trend.courseName}</span>
              <div className="student-course-trend-track" aria-hidden="true">
                <span className="student-course-trend-fill" style={{ width: `${trend.percentage}%` }} />
              </div>
              <span className="student-course-trend-count">{trend.count} 次</span>
              {trend.seasons.length > 0 && (
                <div className="student-course-trend-seasons" aria-label="選課季度">
                  <span className="student-course-trend-seasons-label">季度</span>
                  {trend.seasons.map(season => (
                    <span className="student-course-trend-season" key={season}>{season}</span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="student-course-trend-empty">尚無選課趨勢資料</p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Add responsive chart styling**

Append the following focused rules after the student-detail rules in `dashboard/src/App.css`:

```css
.student-course-trend {
  margin-bottom: 24px;
  padding: 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: rgba(31, 41, 55, 0.3);
}

.student-course-trend-title {
  margin: 0 0 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 600;
}

.student-course-trend-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.student-course-trend-item {
  display: grid;
  grid-template-columns: minmax(110px, 180px) minmax(120px, 1fr) auto;
  gap: 8px 12px;
  align-items: center;
}

.student-course-trend-name {
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.student-course-trend-track {
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
}

.student-course-trend-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--color-accent), #818cf8);
}

.student-course-trend-count {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.student-course-trend-seasons {
  grid-column: 2 / 4;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.student-course-trend-seasons-label,
.student-course-trend-season {
  font-size: 11px;
}

.student-course-trend-seasons-label {
  color: var(--text-muted);
  padding: 3px 0;
}

.student-course-trend-season {
  padding: 3px 8px;
  border: 1px solid rgba(99, 102, 241, 0.2);
  border-radius: 999px;
  color: #c7d2fe;
  background: rgba(99, 102, 241, 0.08);
}

.student-course-trend-empty {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

@media (max-width: 600px) {
  .student-course-trend-item {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .student-course-trend-track,
  .student-course-trend-seasons {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 5: Run the component and domain tests**

Run:

```powershell
npm test -- src/components/students/StudentCourseTrend.test.jsx src/domain/courseTrend.test.js
```

Expected: PASS with 5 passing tests.

- [ ] **Step 6: Commit the component unit**

```powershell
git add dashboard/src/components/students/StudentCourseTrend.jsx dashboard/src/components/students/StudentCourseTrend.test.jsx dashboard/src/App.css
git commit -m "Add student course trend chart"
```

---

### Task 3: Student detail modal integration and regression verification

**Files:**
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Modify: `dashboard/src/components/students/StudentDetailComponents.test.jsx`

**Interfaces:**
- Consumes: `<StudentCourseTrend timeline={studentTimeline} />` from Task 2 and the modal's existing `studentTimeline` memo.
- Produces: The chart immediately before `EnrollmentTimeline` in both student history render paths.

- [ ] **Step 1: Write failing modal integration tests**

Append these tests inside the existing `describe('Student detail components', ...)` block in `dashboard/src/components/students/StudentDetailComponents.test.jsx`:

```jsx
  it('renders the selected student trend before the enrollment timeline', () => {
    const { container } = render(
      <StudentDetailModal
        student={{ ...student, student_id: 'S-002' }}
        enrollments={[
          { enrollment_id: 1, student_id: 'S-001', season: '第十五季', courses: ['電腦課'] },
          { enrollment_id: 2, student_id: 'S-002', season: '第十五季', courses: ['手機課'] },
          { enrollment_id: 3, student_id: 'S-002', season: '第十六季', courses: ['手機課'] },
        ]}
        onClose={vi.fn()}
      />
    )

    const trend = container.querySelector('.student-course-trend')
    const timeline = container.querySelector('.timeline-section')
    expect(trend).not.toBeNull()
    expect(trend.textContent).toContain('手機課')
    expect(trend.textContent).toContain('2 次')
    expect(trend.textContent).not.toContain('電腦課')
    expect(trend.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('also renders the trend in the non-tabbed history layout', () => {
    const { container } = render(
      <StudentDetailModal
        student={student}
        enrollments={[enrollment]}
        isTabbed={false}
        onClose={vi.fn()}
      />
    )

    expect(container.querySelector('.student-course-trend')).not.toBeNull()
    expect(screen.getByRole('heading', { name: '學生選課趨勢圖' })).not.toBeNull()
  })
```

- [ ] **Step 2: Run the modal tests to verify they fail**

Run from `dashboard`:

```powershell
npm test -- src/components/students/StudentDetailComponents.test.jsx
```

Expected: FAIL because `.student-course-trend` is not rendered by `StudentDetailModal`.

- [ ] **Step 3: Integrate the component into both history layouts**

Add the import near the other student/enrollment component imports in `dashboard/src/components/students/StudentDetailModal.jsx`:

```jsx
import StudentCourseTrend from './StudentCourseTrend'
```

In the `!isTabbed` history section, insert the chart immediately before the existing `EnrollmentTimeline`:

```jsx
              <section aria-label="歷年修課" style={{ marginTop: '24px' }}>
                <StudentCourseTrend timeline={studentTimeline} />
                <EnrollmentTimeline
```

In the tabbed history panel, insert the same chart before the existing timeline:

```jsx
            <section role="tabpanel" aria-label="歷年修課">
              <StudentCourseTrend timeline={studentTimeline} />
              <EnrollmentTimeline
```

Preserve every existing permission prop, refresh callback, dialog behavior, and surrounding student-detail markup.

- [ ] **Step 4: Run focused regression tests**

Run:

```powershell
npm test -- src/domain/courseTrend.test.js src/components/students/StudentCourseTrend.test.jsx src/components/students/StudentDetailComponents.test.jsx
```

Expected: PASS for all tests in the three files.

- [ ] **Step 5: Run the production build**

Run:

```powershell
npm run build
```

Expected: exit code 0. A pre-existing Vite chunk-size warning is acceptable; compilation errors are not.

- [ ] **Step 6: Commit the modal integration**

```powershell
git add dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx
git commit -m "Show course trends in student details"
```

- [ ] **Step 7: Integrate and verify the primary startup copy**

After code review, use `superpowers:finishing-a-development-branch` to integrate the three feature commits into the primary workspace without discarding its unrelated modifications. Then run the focused tests and `npm run build` again from the primary `dashboard` directory. Refresh `http://localhost:5173` or restart `啟動系統.bat` and confirm the chart appears above the selected student's enrollment timeline.
