# Period Numeric Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplify the period input across enrollment forms (AddEnrollModal, InitialEnrollmentStep, EnrollmentEditForm) to accept numeric-only input with visual "第 [ 數字 ] 期" affixes, automatically normalizing to "第N期" on submit.

**Architecture:** Add shared CSS classes `.period-input-group`, `.period-prefix`, `.period-suffix`, and `.period-number-input` to `common.css`. Update the three form components to render the numeric input within this group and manage numeric values in local form state while converting to/from the canonical "第N期" format on save/submit using `domain/period.js`.

**Tech Stack:** React 19, Vite, Vitest, Testing Library, Tailwind / Vanilla CSS.

## Global Constraints
- Only numeric inputs allowed in the period field (`type="number"`, `min="1"`, `step="1"`, `inputMode="numeric"`).
- Database RPCs and external APIs must receive canonical `第N期` format.
- All existing and updated unit tests must pass.

---

### Task 1: Add Period Input Group Styles in common.css

**Files:**
- Modify: `dashboard/src/components/common/common.css`

**Interfaces:**
- Produces: CSS classes `.period-input-group`, `.period-prefix`, `.period-suffix`, `.period-number-input`.

- [ ] **Step 1: Add the period input group styles to common.css**

In `dashboard/src/components/common/common.css`, append:

```css
.period-input-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.period-prefix,
.period-suffix {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  user-select: none;
}

.period-number-input {
  flex: 1;
  min-width: 0;
}
```

- [ ] **Step 2: Verify CSS formatting and commit**

```bash
git add dashboard/src/components/common/common.css
git commit -m "style: add period input group styles with prefix and suffix"
```

---

### Task 2: Update AddEnrollModal to Use Numeric Period Input

**Files:**
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.jsx`
- Test: `dashboard/src/components/enrollment/AddEnrollModal.test.jsx`

**Interfaces:**
- Consumes: `periodNumber` from `../../domain/period`, `.period-input-group` styles from `common.css`.
- Produces: `AddEnrollModal` rendering `第 [ input ] 期` and submitting normalized `第N期`.

- [ ] **Step 1: Write / Update the failing test in AddEnrollModal.test.jsx**

In `dashboard/src/components/enrollment/AddEnrollModal.test.jsx`:
Update the test case testing period rendering and submitting to verify `type="number"`, `min="1"`, and entering numeric value `16` submits `第16期`.

```javascript
  it('renders period as number input and submits canonical period format', async () => {
    createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
    const { onClose } = renderModal({ defaultPeriod: '第16期' })

    const periodInput = screen.getByLabelText('修課期別 *')
    expect(periodInput.type).toBe('number')
    expect(periodInput.value).toBe('16')
    expect(screen.getByText('第')).toBeTruthy()
    expect(screen.getByText('期')).toBeTruthy()

    fireEvent.change(periodInput, { target: { value: '18' } })
    fireEvent.change(screen.getByLabelText('開始日期 *'), { target: { value: '2026-09-01' } })
    fireEvent.change(screen.getByLabelText('結束日期 *'), { target: { value: '2026-12-31' } })
    selectCourse('Course A')

    fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

    await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
    expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      period: '第18期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      courses: ['Course A'],
    })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/enrollment/AddEnrollModal.test.jsx` in `dashboard`
Expected: FAIL due to `type="number"` or value mismatch.

- [ ] **Step 3: Update AddEnrollModal.jsx**

In `dashboard/src/components/enrollment/AddEnrollModal.jsx`:
1. Import `periodNumber` from `../../domain/period`.
2. Update `initialEnrollmentState`:
```javascript
const initialEnrollmentState = (defaultPeriod = '第1期') => {
  const num = periodNumber(defaultPeriod)
  return {
    period: num > 0 ? String(num) : '',
    reg_type: '續',
    period_start_date: '',
    period_end_date: '',
    courses: [],
    prepaid_amount: '',
    prepaid_receipt_number: '',
    tuition_fee: '',
    materials_fee: '',
    membership_fee: '',
    fee_receipt_number: '',
    refunded: false,
    refund_info: '',
    notes: '',
    handled_by_name: '',
    handled_on: '',
  }
}
```
3. Update the period input JSX:
```jsx
              <div className="form-group">
                <label className="form-label" htmlFor="add-enrollment-period">修課期別 *</label>
                <div className="period-input-group">
                  <span className="period-prefix">第</span>
                  <input
                    id="add-enrollment-period"
                    name="period"
                    type="number"
                    min="1"
                    step="1"
                    inputMode="numeric"
                    className="form-input period-number-input"
                    value={newEnroll.period}
                    disabled={isSubmitting}
                    onChange={handleChange}
                    required
                    placeholder="16"
                  />
                  <span className="period-suffix">期</span>
                </div>
              </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/enrollment/AddEnrollModal.test.jsx` in `dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/enrollment/AddEnrollModal.jsx dashboard/src/components/enrollment/AddEnrollModal.test.jsx
git commit -m "feat: simplify AddEnrollModal period input to numeric with prefix/suffix"
```

---

### Task 3: Update InitialEnrollmentStep to Use Numeric Period Input

**Files:**
- Modify: `dashboard/src/components/students/InitialEnrollmentStep.jsx`
- Test: `dashboard/src/components/students/InitialEnrollmentStep.test.jsx`
- Test: `dashboard/src/components/students/AddStudentModal.test.jsx`

**Interfaces:**
- Consumes: `.period-input-group` styles from `common.css`.
- Produces: `InitialEnrollmentStep` with numeric period input and `第 [ ] 期` display.

- [ ] **Step 1: Update InitialEnrollmentStep.test.jsx**

In `dashboard/src/components/students/InitialEnrollmentStep.test.jsx`:
Update the test to expect `type="number"`, `min="1"`, `step="1"` for `期別`:

```javascript
    const periodField = screen.getByLabelText('期別')
    expect(periodField.type).toBe('number')
    expect(periodField.min).toBe('1')
    expect(periodField.step).toBe('1')
    expect(screen.getByText('第')).toBeTruthy()
    expect(screen.getByText('期')).toBeTruthy()
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/components/students/InitialEnrollmentStep.test.jsx` in `dashboard`
Expected: FAIL

- [ ] **Step 3: Update InitialEnrollmentStep.jsx**

In `dashboard/src/components/students/InitialEnrollmentStep.jsx`:
Update the `期別` field render:

```jsx
        <Field label="期別" id="initial-enrollment-period">
          <div className="period-input-group">
            <span className="period-prefix">第</span>
            <input
              id="initial-enrollment-period"
              className="form-input period-number-input"
              name="period"
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={enrollment.period ?? ''}
              onChange={onChange}
              disabled={disabled}
              required
              placeholder="16"
            />
            <span className="period-suffix">期</span>
          </div>
        </Field>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/students/InitialEnrollmentStep.test.jsx src/components/students/AddStudentModal.test.jsx` in `dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/students/InitialEnrollmentStep.jsx dashboard/src/components/students/InitialEnrollmentStep.test.jsx
git commit -m "feat: simplify InitialEnrollmentStep period input to numeric with prefix/suffix"
```

---

### Task 4: Update EnrollmentEditForm to Use Numeric Period Input

**Files:**
- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.jsx`
- Test: `dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx`

**Interfaces:**
- Consumes: `periodNumber` from `../../domain/period`.
- Produces: `EnrollmentEditForm` initialized with numeric period and saving canonical `第N期`.

- [ ] **Step 1: Update EnrollmentEditForm.test.jsx**

In `dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx`:
Update tests to verify that when editing an enrollment with `period: '第16期'`, the input displays `'16'` and has `type="number"`:

```javascript
  it('canonicalizes a valid period before updating the enrollment', async () => {
    render(<EnrollmentEditForm enrollment={enrollment} onSave={vi.fn()} onCancel={vi.fn()} />)

    const periodInput = screen.getByLabelText('修課期別')
    expect(periodInput.value).toBe('16')
    expect(periodInput.type).toBe('number')

    fireEvent.click(screen.getByRole('button', { name: '儲存' }))

    await waitFor(() => expect(updateEnrollmentWithCourses).toHaveBeenCalled())
    expect(updateEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
      period: '第16期',
      courses: ['電腦課', '手機課'],
    })
  })
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx vitest run src/components/enrollment/EnrollmentEditForm.test.jsx` in `dashboard`
Expected: FAIL

- [ ] **Step 3: Update EnrollmentEditForm.jsx**

In `dashboard/src/components/enrollment/EnrollmentEditForm.jsx`:
1. Import `periodNumber` from `../../domain/period`.
2. Initialize `period` in `useState`:
```javascript
  const initialPeriodNum = periodNumber(enrollment.period)
  const [form, setForm] = useState({
    period: initialPeriodNum > 0 ? String(initialPeriodNum) : (enrollment.period || ''),
    reg_type: enrollment.reg_type,
    refunded: enrollment.refunded,
    refund_info: enrollment.refund_info,
    courses: enrollment.courses || [],
  })
```
3. Update the JSX for period input:
```jsx
      <div className="form-group">
        <label className="form-label" htmlFor="edit-enrollment-period">修課期別</label>
        <div className="period-input-group">
          <span className="period-prefix">第</span>
          <input
            id="edit-enrollment-period"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            className="form-input period-number-input"
            placeholder="16"
            value={form.period || ''}
            onChange={e => setForm({ ...form, period: e.target.value })}
          />
          <span className="period-suffix">期</span>
        </div>
      </div>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/enrollment/EnrollmentEditForm.test.jsx` in `dashboard`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/enrollment/EnrollmentEditForm.jsx dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx
git commit -m "feat: simplify EnrollmentEditForm period input to numeric with prefix/suffix"
```

---

### Task 5: Full Test Suite and Verification

**Files:**
- None (verification task)

- [ ] **Step 1: Run all unit tests across the repository**

Run: `npm test -- --run` in `dashboard`
Expected: All test suites pass.

- [ ] **Step 2: Run linter**

Run: `npm run lint` in `dashboard`
Expected: No errors.
