# 帳單明細原處編輯功能實作計畫 (Billing Detail In-Place Editing Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為選課帳單明細彈窗（`EnrollmentBillingDetailModal`）新增「編輯」按鈕，支援在彈窗內原處切換為輸入框，編輯並儲存收費明細與辦理資訊至 Supabase。

**Architecture:**
- 服務層 (`enrollmentService.js`) 新增 `updateEnrollmentBillingDetails` 函式，進行數值規格化（金額轉非負整數/null、字串去空白/null、日期格式化）並更新 `enrollments` 資料表。
- 元件層 (`EnrollmentBillingDetailModal.jsx`) 引入 `isEditing` 與 `formData` 狀態，點擊「編輯」時切換為輸入控制項並即時計算費用合計，點擊「儲存」時進行前端校驗並呼叫服務層儲存與刷新。
- 樣式層 (`enrollmentBillingDetail.css`) 增加適應 Grid 佈局的精簡輸入框與文字框樣式。

**Tech Stack:** React 18, Supabase JS Client, Vitest, React Testing Library, Lucide React.

## Global Constraints

- 不新增任何外部 npm 套件依賴。
- 權限控制：僅在 `permissions.canEditEnrollment` 為 `true` 時提供編輯功能。
- 稽核保護：`handled_by_account` 與 `handled_by_user_id` 維持唯讀，不開放前端編輯（後端 trigger 在 UPDATE 時亦保留原值）。
- 所有前端測試必須通過：`npm test` / `npx vitest run`。
- Production build 必須成功：`npm run build`。

---

### Task 1: 服務層 — `updateEnrollmentBillingDetails`

**Files:**
- Modify: `dashboard/src/services/enrollmentService.js`
- Test: `dashboard/src/services/enrollmentService.test.js`

**Interfaces:**
- Produces: `export async function updateEnrollmentBillingDetails(client, enrollmentId, billingData): Promise<void>`
  - `billingData`: `{ prepaid_amount, prepaid_receipt_number, tuition_fee, materials_fee, membership_fee, fee_receipt_number, handled_by_name, handled_on, notes }`

- [ ] **Step 1: 撰寫 `enrollmentService.test.js` 測試案例**

在 `dashboard/src/services/enrollmentService.test.js` 中新增 `updateEnrollmentBillingDetails` 的測試群組：

```javascript
describe('updateEnrollmentBillingDetails', () => {
  function createUpdateClient(result = { error: null }) {
    const calls = []
    return {
      calls,
      client: {
        from(table) {
          calls.push({ table })
          return {
            update(values) {
              calls.push({ operation: 'update', values })
              return {
                eq: async (column, value) => {
                  calls.push({ operation: 'eq', column, value })
                  return result
                },
              }
            },
          }
        },
      },
    }
  }

  it('updates enrollment billing details with normalized payload', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentBillingDetails(client, 42, {
      prepaid_amount: '500',
      prepaid_receipt_number: '  PRE-101  ',
      tuition_fee: 2000,
      materials_fee: '0',
      membership_fee: '',
      fee_receipt_number: ' FEE-202 ',
      handled_by_name: ' 張管理員 ',
      handled_on: '2026-08-18',
      notes: ' 備註事項 ',
    })

    expect(calls).toEqual([
      { table: 'enrollments' },
      {
        operation: 'update',
        values: {
          prepaid_amount: 500,
          prepaid_receipt_number: 'PRE-101',
          tuition_fee: 2000,
          materials_fee: 0,
          membership_fee: null,
          fee_receipt_number: 'FEE-202',
          handled_by_name: '張管理員',
          handled_on: '2026-08-18',
          notes: '備註事項',
        },
      },
      { operation: 'eq', column: 'enrollment_id', value: 42 },
    ])
  })

  it('handles empty or null fields gracefully by setting them to null', async () => {
    const { client, calls } = createUpdateClient()

    await updateEnrollmentBillingDetails(client, '43', {
      prepaid_amount: '',
      prepaid_receipt_number: '   ',
      tuition_fee: null,
      materials_fee: undefined,
      membership_fee: '',
      fee_receipt_number: '',
      handled_by_name: '',
      handled_on: '',
      notes: '   ',
    })

    expect(calls).toContainEqual({
      operation: 'update',
      values: {
        prepaid_amount: null,
        prepaid_receipt_number: null,
        tuition_fee: null,
        materials_fee: null,
        membership_fee: null,
        fee_receipt_number: null,
        handled_by_name: null,
        handled_on: null,
        notes: null,
      },
    })
  })

  it('throws when update fails', async () => {
    const updateError = new Error('update permission denied')
    const { client } = createUpdateClient({ error: updateError })

    await expect(
      updateEnrollmentBillingDetails(client, 42, { prepaid_amount: 100 })
    ).rejects.toThrow('update permission denied')
  })
})
```

- [ ] **Step 2: 執行測試驗證失敗**

在 `dashboard` 目錄執行：
```bash
npx vitest run src/services/enrollmentService.test.js
```
預期結果：FAIL（`updateEnrollmentBillingDetails is not defined`）。

- [ ] **Step 3: 實作 `updateEnrollmentBillingDetails`**

在 `dashboard/src/services/enrollmentService.js` 中新增輔助正規化函式與 `updateEnrollmentBillingDetails`：

```javascript
function normalizeAmount(value) {
  if (value == null || String(value).trim() === '') return null
  const num = Number(value)
  if (Number.isNaN(num) || num < 0) throw new Error('金額必須為非負整數')
  return Math.round(num)
}

function normalizeText(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

function normalizeDate(value) {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed === '' ? null : trimmed
}

export async function updateEnrollmentBillingDetails(client, enrollmentId, billingData = {}) {
  const payload = {
    prepaid_amount: normalizeAmount(billingData.prepaid_amount),
    prepaid_receipt_number: normalizeText(billingData.prepaid_receipt_number),
    tuition_fee: normalizeAmount(billingData.tuition_fee),
    materials_fee: normalizeAmount(billingData.materials_fee),
    membership_fee: normalizeAmount(billingData.membership_fee),
    fee_receipt_number: normalizeText(billingData.fee_receipt_number),
    handled_by_name: normalizeText(billingData.handled_by_name),
    handled_on: normalizeDate(billingData.handled_on),
    notes: normalizeText(billingData.notes),
  }

  const { error } = await client
    .from('enrollments')
    .update(payload)
    .eq('enrollment_id', Number(enrollmentId))

  if (error) throw error
}
```

- [ ] **Step 4: 執行測試驗證通過**

在 `dashboard` 目錄執行：
```bash
npx vitest run src/services/enrollmentService.test.js
```
預期結果：PASS（所有測試通過）。

- [ ] **Step 5: 提交 Commit**

```bash
git add dashboard/src/services/enrollmentService.js dashboard/src/services/enrollmentService.test.js
git commit -m "feat: add updateEnrollmentBillingDetails service function"
```

---

### Task 2: 元件層與樣式 — 原處編輯互動、即時計算與整合

**Files:**
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`
- Modify: `dashboard/src/components/enrollment/enrollmentBillingDetail.css`
- Test: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx`

**Interfaces:**
- Consumes: `updateEnrollmentBillingDetails(client, enrollmentId, billingData)` from `../../services/enrollmentService`
- Consumes: `updateEnrollmentRefundStatus(client, enrollmentId, refunded, refundInfo)` from `../../services/enrollmentService`

- [ ] **Step 1: 擴充 `EnrollmentBillingDetailModal.test.jsx` 測試案例**

在 `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx` 中新增編輯模式相關測試：

```javascript
// 在 vi.mock('../../services/enrollmentService', ...) 引入 updateEnrollmentBillingDetails
vi.mock('../../services/enrollmentService', () => ({
  updateEnrollmentRefundStatus: vi.fn(),
  updateEnrollmentBillingDetails: vi.fn(),
}))

// 新增測試案例：
it('renders edit button in header when user has permission', () => {
  renderModal()
  expect(screen.getByRole('button', { name: '編輯' })).toBeTruthy()
})

it('hides edit button for viewers', () => {
  authState.role = 'viewer'
  renderModal()
  expect(screen.queryByRole('button', { name: '編輯' })).toBeNull()
})

it('toggles into edit mode and reverts on cancel', () => {
  renderModal()
  fireEvent.click(screen.getByRole('button', { name: '編輯' }))

  expect(screen.getByRole('button', { name: '儲存' })).toBeTruthy()
  expect(screen.getByRole('button', { name: '取消' })).toBeTruthy()
  expect(screen.queryByRole('button', { name: '標記退費' })).toBeNull()

  const prepaidInput = screen.getByLabelText('預繳金額')
  expect(prepaidInput.value).toBe('500')
  fireEvent.change(prepaidInput, { target: { value: '800' } })
  expect(prepaidInput.value).toBe('800')

  fireEvent.click(screen.getByRole('button', { name: '取消' }))
  expect(screen.getByRole('button', { name: '編輯' })).toBeTruthy()
  expect(screen.getByText('NT$ 500')).toBeTruthy()
})

it('dynamically calculates total formal fee during editing', () => {
  renderModal()
  fireEvent.click(screen.getByRole('button', { name: '編輯' }))

  const tuitionInput = screen.getByLabelText('學費')
  const materialsInput = screen.getByLabelText('教材費')
  const membershipInput = screen.getByLabelText('會友費')

  fireEvent.change(tuitionInput, { target: { value: '2000' } })
  fireEvent.change(materialsInput, { target: { value: '300' } })
  fireEvent.change(membershipInput, { target: { value: '100' } })

  expect(screen.getByLabelText('正式費用合計').textContent).toBe('NT$ 2400')
})

it('validates negative fee and shows error without submitting', async () => {
  renderModal()
  fireEvent.click(screen.getByRole('button', { name: '編輯' }))

  const tuitionInput = screen.getByLabelText('學費')
  fireEvent.change(tuitionInput, { target: { value: '-100' } })

  fireEvent.click(screen.getByRole('button', { name: '儲存' }))

  expect(await screen.findByRole('alert')).toBeTruthy()
  expect(updateEnrollmentBillingDetails).not.toHaveBeenCalled()
})

it('submits updated billing details successfully and refreshes', async () => {
  vi.mocked(updateEnrollmentBillingDetails).mockResolvedValue(undefined)
  const { props } = renderModal()

  fireEvent.click(screen.getByRole('button', { name: '編輯' }))

  fireEvent.change(screen.getByLabelText('預繳金額'), { target: { value: '600' } })
  fireEvent.change(screen.getByLabelText('經手人'), { target: { value: '李專員' } })
  fireEvent.change(screen.getByLabelText('備註'), { target: { value: '已確認款項' } })

  fireEvent.click(screen.getByRole('button', { name: '儲存' }))

  await waitFor(() => {
    expect(updateEnrollmentBillingDetails).toHaveBeenCalledWith(
      expect.anything(),
      42,
      expect.objectContaining({
        prepaid_amount: '600',
        handled_by_name: '李專員',
        notes: '已確認款項',
      })
    )
  })

  expect(props.onRefresh).toHaveBeenCalledOnce()
  expect(screen.getByText('帳單明細已更新')).toBeTruthy()
  expect(screen.getByRole('button', { name: '編輯' })).toBeTruthy()
})
```

- [ ] **Step 2: 執行測試驗證失敗**

在 `dashboard` 目錄執行：
```bash
npx vitest run src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
```
預期結果：FAIL。

- [ ] **Step 3: 實作 `EnrollmentBillingDetailModal.jsx` 與 `enrollmentBillingDetail.css`**

1. 修改 `EnrollmentBillingDetailModal.jsx`：
   - 定義初始狀態輔助函式 `createInitialFormData(enrollment)`。
   - 監聽 `enrollment` 變化重設 `formData`。
   - 加入 `isEditing` 模式切換邏輯。
   - 當 `isEditing` 為 `true` 時：
     - Header 動作按鈕切換為 `[儲存]`、`[取消]`。
     - 收費明細與辦理資訊內欄位轉為帶有 `aria-label` 的 `<input>` 與 `<textarea>`，套用 `.billing-edit-input` 與 `.billing-edit-textarea`。
     - 正式費用合計即時計算：
       ```javascript
       const calcTotal = (formData.tuition_fee || formData.materials_fee || formData.membership_fee)
         ? (Number(formData.tuition_fee) || 0) + (Number(formData.materials_fee) || 0) + (Number(formData.membership_fee) || 0)
         : null
       ```
     - 儲存處理函式 `handleSave`：防禦負數校驗、呼叫 `updateEnrollmentBillingDetails`、成功後 `setSuccess('帳單明細已更新')`、`onRefresh?.()`、`setIsEditing(false)`。
     - 取消處理函式 `handleCancel`：還原 `formData`、`setIsEditing(false)`、清除錯誤訊息。

2. 修改 `enrollmentBillingDetail.css`：
   - 新增 `.billing-edit-input` 與 `.billing-edit-textarea` 樣式。
   - 確保在 `.fee-details-card`、`.fee-breakdown`、`.handler-info-grid` 下適配寬度與留白。

- [ ] **Step 4: 執行測試驗證通過**

在 `dashboard` 目錄執行：
```bash
npx vitest run src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
```
預期結果：PASS（所有測試通過）。

- [ ] **Step 5: 執行完整前端測試與 Build**

在 `dashboard` 目錄執行：
```bash
npx vitest run
npm run build
```
預期結果：所有測試全部通過，`dist/` 輸出成功。

- [ ] **Step 6: 提交 Commit**

```bash
git add dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx dashboard/src/components/enrollment/enrollmentBillingDetail.css dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
git commit -m "feat: add in-place editing to enrollment billing detail modal"
```
