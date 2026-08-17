# EnrollmentTimeline 繳費紀錄整合 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 StudentDetailModal 內的 EnrollmentTimeline 時間軸卡片顯示繳費摘要並可點擊開啟繳費明細視窗。

**Architecture:** 在 EnrollmentTimeline 卡片加入 `summarizeEnrollmentBilling` 摘要顯示與 `onSelectEnrollment` 點擊回呼；StudentDetailModal 管理選中狀態並堆疊渲染現有的 EnrollmentBillingDetailModal；CSS 確保堆疊 z-index 正確。

**Tech Stack:** React 19, Vitest 4, React Testing Library 16

## Global Constraints

- 不新增任何 npm 依賴
- 不變更資料庫 schema、RPC 或 services 層
- 不修改 App.jsx 中從 EnrollmentTab 觸發 EnrollmentBillingDetailModal 的流程
- 測試指令：`npx vitest run` （工作目錄 `dashboard`）
- 所有 CSS 變數已在 `index.css` 全域定義，直接引用即可

---

### Task 1: EnrollmentTimeline 顯示繳費摘要與卡片點擊

**Files:**
- Modify: `dashboard/src/components/enrollment/EnrollmentTimeline.jsx`
- Modify: `dashboard/src/components/enrollment/enrollment.css`
- Test: `dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx` (Create)

**Interfaces:**
- Consumes: `summarizeEnrollmentBilling(enrollment)` from `domain/enrollmentBilling.js` — returns `{ amount: number|null, invoiceNumbers: string[], source: 'legacy'|'receipts' }`
- Produces: New prop `onSelectEnrollment(enrollment)` — called when a timeline card is clicked (not during inline editing, not when edit/delete buttons are clicked)

- [ ] **Step 1: Write the failing tests**

Create `dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx`:

```jsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import EnrollmentTimeline from './EnrollmentTimeline'

vi.mock('../../domain/enrollmentBilling', () => ({
  summarizeEnrollmentBilling: vi.fn(enrollment => {
    if (enrollment.billingReceipts && enrollment.billingReceipts.length > 0) {
      return {
        amount: enrollment.billingReceipts.reduce((sum, r) => sum + (r.amount || 0), 0),
        invoiceNumbers: enrollment.billingReceipts.map(r => r.invoiceNumber).filter(Boolean),
        source: 'receipts',
      }
    }
    return { amount: null, invoiceNumbers: [], source: 'legacy' }
  }),
}))

vi.mock('./EnrollmentEditForm', () => ({
  default: ({ onSave, onCancel }) => (
    <div data-testid="edit-form">
      <button onClick={onSave}>save</button>
      <button onClick={onCancel}>cancel</button>
    </div>
  ),
}))

const baseItem = {
  enrollment_id: 1,
  period: '第十五季',
  reg_type: '新',
  refunded: false,
  courses: ['瑜珈課', '手機課'],
  billingReceipts: [],
  courseDetails: [],
}

describe('EnrollmentTimeline', () => {
  afterEach(cleanup)

  describe('billing summary display', () => {
    it('shows amount and invoice numbers when billing receipts exist', () => {
      const item = {
        ...baseItem,
        billingReceipts: [
          { receiptId: 1, amount: 1500, invoiceNumber: 'A-001', courses: [] },
          { receiptId: 2, amount: 500, invoiceNumber: 'A-002', courses: [] },
        ],
      }

      render(<EnrollmentTimeline timeline={[item]} />)

      expect(screen.getByText('NT$ 2000')).toBeTruthy()
      expect(screen.getByText('A-001, A-002')).toBeTruthy()
    })

    it('shows "--" when no billing data exists', () => {
      render(<EnrollmentTimeline timeline={[baseItem]} />)

      const summaries = screen.getAllByTestId('timeline-billing-summary')
      expect(summaries).toHaveLength(1)
      // Both amount and invoice show '--'
      const dashes = summaries[0].querySelectorAll('span')
      const texts = Array.from(dashes).map(el => el.textContent)
      expect(texts.filter(t => t === '--')).toHaveLength(2)
    })
  })

  describe('card click behavior', () => {
    it('calls onSelectEnrollment with the enrollment when card is clicked', () => {
      const onSelectEnrollment = vi.fn()

      render(
        <EnrollmentTimeline
          timeline={[baseItem]}
          onSelectEnrollment={onSelectEnrollment}
        />
      )

      fireEvent.click(screen.getByText('第十五季').closest('.timeline-card'))

      expect(onSelectEnrollment).toHaveBeenCalledOnce()
      expect(onSelectEnrollment).toHaveBeenCalledWith(baseItem)
    })

    it('does not call onSelectEnrollment when edit button is clicked', () => {
      const onSelectEnrollment = vi.fn()

      render(
        <EnrollmentTimeline
          timeline={[baseItem]}
          onSelectEnrollment={onSelectEnrollment}
          onEditEnrollment={true}
        />
      )

      const editBtn = screen.getByRole('button', { name: '' })
      // Edit2 icon button is the first action button
      const actionBtns = document.querySelectorAll('.timeline-action-btn')
      fireEvent.click(actionBtns[0])

      expect(onSelectEnrollment).not.toHaveBeenCalled()
    })

    it('does not call onSelectEnrollment when delete button is clicked', () => {
      const onSelectEnrollment = vi.fn()
      const onDelete = vi.fn()

      render(
        <EnrollmentTimeline
          timeline={[baseItem]}
          onSelectEnrollment={onSelectEnrollment}
          onDelete={onDelete}
        />
      )

      const actionBtns = document.querySelectorAll('.timeline-action-btn.danger')
      fireEvent.click(actionBtns[0])

      expect(onSelectEnrollment).not.toHaveBeenCalled()
      expect(onDelete).toHaveBeenCalledOnce()
    })

    it('does not call onSelectEnrollment when card is in editing mode', () => {
      const onSelectEnrollment = vi.fn()

      render(
        <EnrollmentTimeline
          timeline={[baseItem]}
          onSelectEnrollment={onSelectEnrollment}
          onEditEnrollment={true}
        />
      )

      // Enter editing mode
      const editBtns = document.querySelectorAll('.timeline-action-btn')
      fireEvent.click(editBtns[0])

      // Now click the card area
      const card = screen.getByTestId('edit-form').closest('.timeline-card')
      fireEvent.click(card)

      expect(onSelectEnrollment).not.toHaveBeenCalled()
    })

    it('does not throw when onSelectEnrollment is not provided', () => {
      render(<EnrollmentTimeline timeline={[baseItem]} />)

      expect(() => {
        fireEvent.click(screen.getByText('第十五季').closest('.timeline-card'))
      }).not.toThrow()
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/enrollment/EnrollmentTimeline.test.jsx`
Working directory: `dashboard`
Expected: FAIL — no billing summary rendered, no `onSelectEnrollment` prop handled

- [ ] **Step 3: Implement EnrollmentTimeline changes**

Replace the full content of `dashboard/src/components/enrollment/EnrollmentTimeline.jsx` with:

```jsx
import { Activity, Edit2, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { summarizeEnrollmentBilling } from '../../domain/enrollmentBilling'
import EnrollmentEditForm from './EnrollmentEditForm'

function BillingSummary({ enrollment }) {
  const billing = summarizeEnrollmentBilling(enrollment)
  const amountText = billing.amount == null ? '--' : `NT$ ${billing.amount}`
  const invoiceText = billing.invoiceNumbers.length > 0
    ? billing.invoiceNumbers.join(', ')
    : '--'

  return (
    <div className="timeline-billing-summary" data-testid="timeline-billing-summary">
      <span>{amountText}</span>
      <span>{invoiceText}</span>
    </div>
  )
}

export default function EnrollmentTimeline({ timeline, onDelete, onAddEnrollment, onEditEnrollment = true, onRefresh, onSelectEnrollment }) {
  const [editingEnrollId, setEditingEnrollId] = useState(null)

  useEffect(() => {
    if (!onEditEnrollment) setEditingEnrollId(null)
  }, [onEditEnrollment])

  // 表單儲存後先收起內嵌編輯器，再交由外層 `onRefresh` 重新取得最新的報名時間軸。
  const handleSave = () => {
    setEditingEnrollId(null)
    if (onRefresh) onRefresh()
  }

  const handleCardClick = (item) => {
    if (editingEnrollId === item.enrollment_id) return
    onSelectEnrollment?.(item)
  }

  return (
    <div className="timeline-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 className="timeline-title" style={{ margin: 0 }}><Activity size={16} />歷年修課歷程 ({timeline.length} 期)</h3>
        {onAddEnrollment && <button type="button" className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px' }} onClick={onAddEnrollment} id="btn-add-enrollment-modal"><span>+ 新增選課紀錄</span></button>}
      </div>
      {timeline.length > 0 ? (
        <div className="timeline-container">
          {timeline.map((item, idx) => (
            <div className={`timeline-item ${idx === timeline.length - 1 ? 'active' : ''} ${item.refunded ? 'refunded' : ''}`} key={item.enrollment_id}>
              <div className="timeline-dot" />
              <div
                className="timeline-card"
                onClick={() => handleCardClick(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCardClick(item) } }}
              >
                <div className="timeline-meta">
                  <span className="timeline-period">{item.period}</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {item.reg_type && <span className="timeline-reg-type">{item.reg_type === '新' ? '新生' : '續生'}</span>}
                    {item.refunded && <span className="badge danger" style={{ padding: '1px 6px', fontSize: '10px' }}>已退費</span>}
                  </div>
                  <div className="timeline-actions">
                    {onEditEnrollment && (
                      <button type="button" className="timeline-action-btn" onClick={(e) => { e.stopPropagation(); if (onEditEnrollment) setEditingEnrollId(item.enrollment_id) }}>
                        <Edit2 size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button type="button" className="timeline-action-btn danger" onClick={(e) => { e.stopPropagation(); onDelete(item.enrollment_id) }}>
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                {onEditEnrollment && editingEnrollId === item.enrollment_id ? (
                  <EnrollmentEditForm enrollment={item} onSave={handleSave} onCancel={() => setEditingEnrollId(null)} />
                ) : (
                  <>
                    <div className="timeline-courses">
                      {item.courses && item.courses.length > 0
                        ? item.courses.map(course => <span className="course-tag" key={course}>{course}</span>)
                        : <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>無選課紀錄/僅進行測驗</span>}
                    </div>
                    <BillingSummary enrollment={item} />
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : <p style={{ color: 'var(--text-muted)', fontSize: '13px', paddingLeft: '12px' }}>無修課歷程</p>}
    </div>
  )
}
```

- [ ] **Step 4: Add CSS for billing summary and card cursor**

Append to `dashboard/src/components/enrollment/enrollment.css`:

```css
.timeline-card {
  cursor: pointer;
}

.timeline-billing-summary {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted);
}
```

Note: `.timeline-card` already has `transition` and `:hover` styles defined (lines 57-68), so cursor is the only addition needed. Since `.timeline-card` is already defined earlier in the file, add only the `cursor: pointer` rule to the existing block at line 57-63 instead of creating a duplicate selector. If merging into the existing block, add `cursor: pointer;` after line 62 (`transition: all 0.2s ease;`). The `.timeline-billing-summary` block is new and appended at the end of the file.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/enrollment/EnrollmentTimeline.test.jsx`
Working directory: `dashboard`
Expected: All tests PASS

- [ ] **Step 6: Run existing enrollment tests to verify no regressions**

Run: `npx vitest run src/components/enrollment/`
Working directory: `dashboard`
Expected: All tests PASS (existing EnrollmentTab, EnrollmentBillingDetailModal, EnrollmentEditForm, PaymentRecordsEditor, CourseTagPicker, AddEnrollModal tests unchanged)

- [ ] **Step 7: Commit**

```
git add -f dashboard/src/components/enrollment/EnrollmentTimeline.jsx dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx dashboard/src/components/enrollment/enrollment.css
git commit -m "feat: add billing summary and click-to-open on EnrollmentTimeline cards"
```

---

### Task 2: StudentDetailModal 堆疊渲染 EnrollmentBillingDetailModal

**Files:**
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Modify: `dashboard/src/components/enrollment/enrollmentBillingDetail.css`
- Test: `dashboard/src/components/students/StudentDetailComponents.test.jsx` (Modify — add new tests)

**Interfaces:**
- Consumes: `EnrollmentTimeline` prop `onSelectEnrollment(enrollment)` from Task 1
- Consumes: `EnrollmentBillingDetailModal` component — props `{ student, enrollment, onClose, onRefresh }`
- Produces: No new external interfaces (internal state only)

- [ ] **Step 1: Read the existing test file to understand patterns**

Read `dashboard/src/components/students/StudentDetailComponents.test.jsx` to understand how `StudentDetailModal` is tested, what mocks exist, and the render patterns used.

- [ ] **Step 2: Write the failing tests**

Add the following test cases to `dashboard/src/components/students/StudentDetailComponents.test.jsx` (append at the end of the existing describe block, or create a new describe block):

```jsx
describe('StudentDetailModal billing integration', () => {
  const mockStudent = { student_id: '1', name: '測試學員', gender: '男' }
  const mockEnrollment = {
    enrollment_id: 101,
    student_id: '1',
    period: '第十五季',
    reg_type: '新',
    refunded: false,
    courses: ['瑜珈課'],
    billingReceipts: [
      { receiptId: 1, amount: 1500, invoiceNumber: 'A-001', courses: [{ courseId: 1, courseName: '瑜珈課' }] },
    ],
    courseDetails: [
      { courseId: 1, courseName: '瑜珈課', billingReceiptId: 1 },
    ],
  }

  it('opens EnrollmentBillingDetailModal when a timeline card is clicked', () => {
    render(
      <StudentDetailModal
        student={mockStudent}
        enrollments={[mockEnrollment]}
        initialTab="history"
        isTabbed={true}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    // Click the timeline card
    fireEvent.click(screen.getByText('第十五季').closest('[role="button"]'))

    // The billing detail modal should appear with the student name and period
    expect(screen.getByText('帳單明細')).toBeTruthy()
    expect(screen.getByText('測試學員 · 第十五季')).toBeTruthy()
  })

  it('closes EnrollmentBillingDetailModal and returns to student detail', () => {
    render(
      <StudentDetailModal
        student={mockStudent}
        enrollments={[mockEnrollment]}
        initialTab="history"
        isTabbed={true}
        onClose={vi.fn()}
        onRefresh={vi.fn()}
      />
    )

    // Open billing modal
    fireEvent.click(screen.getByText('第十五季').closest('[role="button"]'))
    expect(screen.getByText('帳單明細')).toBeTruthy()

    // Close billing modal via X button
    const closeButtons = screen.getAllByLabelText(/close/i)
    // The billing modal close button is the last one rendered
    fireEvent.click(closeButtons[closeButtons.length - 1])

    // Billing modal should be gone, student detail should remain
    expect(screen.queryByText('帳單明細')).toBeNull()
    expect(screen.getByText('測試學員')).toBeTruthy()
  })
})
```

Note: The exact mock setup will depend on how the existing test file mocks dependencies (AuthContext, supabaseClient, etc.). Adapt to match the existing patterns found in Step 1.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/students/StudentDetailComponents.test.jsx`
Working directory: `dashboard`
Expected: FAIL — no billing modal opens on card click

- [ ] **Step 4: Implement StudentDetailModal changes**

Modify `dashboard/src/components/students/StudentDetailModal.jsx`:

**4a. Add import** (after the existing `EnrollmentTimeline` import):
```jsx
import EnrollmentBillingDetailModal from '../enrollment/EnrollmentBillingDetailModal'
```

**4b. Add state** (after `const [pendingDeleteEnrollmentId, setShowDeleteEnrollConfirm] = useState(null)`):
```jsx
const [selectedBillingEnrollment, setSelectedBillingEnrollment] = useState(null)
```

**4c. Clear billing state on student change** — in the existing `useEffect` that resets on `student?.student_id` change, add `setSelectedBillingEnrollment(null)`:
```jsx
useEffect(() => {
  setActiveDetailTab(initialTab)
  setIsEditing(false)
  setHasUnsavedStudentChanges(false)
  setSelectedBillingEnrollment(null)
}, [student?.student_id, initialTab, setHasUnsavedStudentChanges])
```

**4d. Pass `onSelectEnrollment` to EnrollmentTimeline** — in BOTH render locations (tabbed and untabbed), add the prop:
```jsx
<EnrollmentTimeline
  timeline={studentTimeline}
  onDelete={permissions.canDeleteEnrollment ? setShowDeleteEnrollConfirm : null}
  onAddEnrollment={permissions.canAddEnrollment ? onAddEnrollment : null}
  onEditEnrollment={permissions.canEditEnrollment}
  onRefresh={onRefresh}
  onSelectEnrollment={setSelectedBillingEnrollment}
/>
```

**4e. Render stacked EnrollmentBillingDetailModal** — in BOTH return branches (tabbed and untabbed), add after the last `<ConfirmDialog>`:
```jsx
{selectedBillingEnrollment && (
  <EnrollmentBillingDetailModal
    student={student}
    enrollment={selectedBillingEnrollment}
    onClose={() => setSelectedBillingEnrollment(null)}
    onRefresh={() => {
      setSelectedBillingEnrollment(null)
      onRefresh?.()
    }}
  />
)}
```

- [ ] **Step 5: Add CSS z-index for stacking**

Add to `dashboard/src/components/enrollment/enrollmentBillingDetail.css` (at the top, after the existing `.enrollment-billing-dialog` block):

```css
.enrollment-billing-overlay {
  z-index: 110;
}
```

This ensures `EnrollmentBillingDetailModal` (z-index 110) stacks above `StudentDetailModal`'s `.modal-overlay` (z-index 100).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/components/students/StudentDetailComponents.test.jsx`
Working directory: `dashboard`
Expected: All tests PASS (both new and existing)

- [ ] **Step 7: Run full test suite to verify no regressions**

Run: `npx vitest run`
Working directory: `dashboard`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```
git add -f dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/components/enrollment/enrollmentBillingDetail.css
git commit -m "feat: stack EnrollmentBillingDetailModal inside StudentDetailModal on timeline card click"
```
