# EnrollmentTimeline 繳費紀錄整合設計

## 目的

學員詳情 Modal 內的 `EnrollmentTimeline` 時間軸卡片目前不顯示任何繳費資訊，也無法開啟繳費明細視窗。使用者必須離開學員詳情、切到「歷年選課歷程」分頁才能查看或管理繳費紀錄。

本設計讓 `EnrollmentTimeline` 的每張卡片直接顯示繳費摘要（金額與發票編號），並且點擊卡片可在 `StudentDetailModal` 上方堆疊開啟現有的 `EnrollmentBillingDetailModal`。

## 範圍

- 改動限於前端 UI 層，不涉及資料庫或 API 變更。
- `EnrollmentTab`（獨立分頁）的現有行為完全不受影響。

## 資料可用性

`StudentDetailModal` 透過 `getEnrollmentsForStudent(enrollments, student.student_id)` 產生 `studentTimeline`，其中每個 enrollment 物件已包含 `billingReceipts`、`courseDetails`、`amount`、`invoice_number` 等欄位。繳費摘要可透過現有的 `summarizeEnrollmentBilling(enrollment)` 直接計算，不需額外 API 呼叫。

## 變更細節

### 1. EnrollmentTimeline.jsx

**新增 prop**：`onSelectEnrollment(enrollment)` — 由外層傳入，點擊卡片時呼叫。

**卡片繳費摘要**：在每張時間軸卡片的課程標籤下方，新增一行繳費摘要：

- 使用 `summarizeEnrollmentBilling(item)` 取得 `{ amount, invoiceNumbers }`。
- 有金額時顯示 `NT$ {amount}`；無金額時顯示 `--`。
- 有發票編號時列出（以逗號分隔）；無時顯示 `--`。
- 樣式：字體 12px、淡色文字（`var(--text-muted)`），與課程標籤間距 8px。

**卡片點擊行為**：

- `.timeline-card` 加上 `onClick={() => onSelectEnrollment?.(item)}`。
- 當卡片處於 inline 編輯模式（`editingEnrollId === item.enrollment_id`）時，不響應卡片點擊。
- 編輯按鈕（`<Edit2>`）和刪除按鈕（`<Trash2>`）加上 `e.stopPropagation()` 阻止冒泡。

### 2. StudentDetailModal.jsx

**新增 state**：`const [selectedBillingEnrollment, setSelectedBillingEnrollment] = useState(null)`。

**State 清除**：當 `student.student_id` 變化時，清除 `selectedBillingEnrollment`。

**傳遞 callback**：在兩處 `<EnrollmentTimeline>` 渲染（tabbed 模式和 untabbed 模式）都傳入 `onSelectEnrollment={setSelectedBillingEnrollment}`。

**堆疊渲染 EnrollmentBillingDetailModal**：在 JSX 末尾（與 `ConfirmDialog` 同層級）條件渲染：

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

`EnrollmentBillingDetailModal` 自帶 `.modal-overlay`，其 z-index 需高於 `.student-detail-overlay` 以形成視覺堆疊。

### 3. CSS 調整

**enrollment.css**：

- `.timeline-card`：加上 `cursor: pointer`；hover 時微調背景色（例如 `background: var(--bg-hover)`）提示可點擊。
- `.timeline-billing-summary`（新增 class）：`font-size: 12px`、`color: var(--text-muted)`、`margin-top: 8px`、`display: flex`、`gap: 12px`。

**enrollmentBillingDetail.css**：

- 確認 `.enrollment-billing-overlay` 的 `z-index` 高於 `.student-detail-overlay`。若現有值已滿足（`enrollment-billing-overlay` 較晚渲染且 z-index 較高），則無需調整。

## 不變的部分

- `App.jsx` 中從 `EnrollmentTab` 觸發 `EnrollmentBillingDetailModal` 的流程完全不動。
- `EnrollmentTimeline` 的 inline 編輯（`EnrollmentEditForm`）和刪除功能不受影響。
- `EnrollmentBillingDetailModal` 本身不做任何改動。
- 資料庫 schema、RPC、services 層皆無變更。

## 測試驗證

### EnrollmentTimeline 測試

- 有繳費資料（`billingReceipts` 非空）的卡片顯示正確金額與發票編號。
- 無繳費資料的卡片顯示 `--`。
- 有舊制帳單（`enrollment.amount` / `enrollment.invoice_number`）且無 receipts 時，顯示舊制金額。
- 點擊卡片觸發 `onSelectEnrollment` 並傳入正確的 enrollment 物件。
- 點擊編輯按鈕不觸發 `onSelectEnrollment`。
- 點擊刪除按鈕不觸發 `onSelectEnrollment`。
- 卡片處於 inline 編輯模式時，點擊不觸發 `onSelectEnrollment`。

### StudentDetailModal 測試

- 點擊時間軸卡片後，`EnrollmentBillingDetailModal` 出現。
- 關閉帳單明細後，回到學員詳情，`EnrollmentBillingDetailModal` 消失。
- 切換學員時，先前開啟的帳單明細自動關閉。
