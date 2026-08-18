# 帳單明細原處編輯功能設計規格（Design Spec）

## 1. 概述 (Overview)

在選課帳單明細彈窗（`EnrollmentBillingDetailModal`）中新增「編輯」按鈕，允許具備權限的使用者以原處切換（In-place Toggle）的方式修改選課記錄中的收費明細（預繳、正式費用）與辦理資訊（經手人、辦理日期、備註）。

---

## 2. 功能需求與範疇 (Requirements & Scope)

### 2.1 可編輯欄位
- **收費明細 (Fee Details)**：
  - `prepaid_amount`（預繳金額，整數或 null）
  - `prepaid_receipt_number`（預繳收據號碼，字串或 null）
  - `tuition_fee`（學費，整數或 null）
  - `materials_fee`（教材費，整數或 null）
  - `membership_fee`（會友費，整數或 null）
  - `fee_receipt_number`（正式收據號碼，字串或 null）
- **辦理資訊 (Handler Info)**：
  - `handled_by_name`（經手人姓名，字串或 null）
  - `handled_on`（辦理日期，YYYY-MM-DD 或 null）
  - `notes`（備註，字串或 null）
- **唯讀欄位（不開放手動編輯）**：
  - `handled_by_account`（登入帳號，由系統稽核鎖定）
  - `handled_by_user_id`（稽核使用者 UUID）
  - 選課清單（`courses`）、期別與學員資訊

### 2.2 權限與操作邏輯
- 僅在 `permissions.canEditEnrollment` 為 `true` 時提供「編輯」功能。
- **檢視模式 (View Mode)**：
  - 標題列顯示：退費狀態 Badge、`[標記退費 / 取消退費]` 按鈕、`[編輯]` 按鈕。
- **編輯模式 (Edit Mode)**：
  - 標題列右側替換為：`[儲存]`（Primary）與 `[取消]`（Secondary）按鈕。
  - 編輯進行中時隱藏或禁用「標記退費」按鈕。
  - 各編輯欄位原處轉為對應的輸入元件（`<input>` / `<textarea>`）。
  - 正式費用合計欄位即時連動計算：`預估合計 = (學費 || 0) + (教材費 || 0) + (會友費 || 0)`。
  - 點擊 `[取消]`：放棄所有修改，欄位還原為原始狀態並回到檢視模式。
  - 點擊 `[儲存]`：
    1. 驗證資料有效性（金額必須為非負整數、日期格式合規）。
    2. 若驗證不通過，顯示錯誤訊息並留在編輯模式。
    3. 若驗證通過，呼叫 `updateEnrollmentBillingDetails` 寫入 Supabase。
    4. 儲存成功後顯示提示「帳單明細已更新」，呼叫 `onRefresh?.()` 重新載入資料並退出編輯模式。
    5. 儲存失敗時顯示錯誤提示，並維持在編輯模式以保留使用者輸入。

---

## 3. 架構與實作細節 (Architecture & Implementation)

### 3.1 服務層 (`dashboard/src/services/enrollmentService.js`)
新增 `updateEnrollmentBillingDetails` 函式：
```javascript
export async function updateEnrollmentBillingDetails(client, enrollmentId, billingData) {
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

### 3.2 元件層 (`dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`)
- 引入表單狀態 `isEditing` 與 `formData`。
- 表單輸入欄位配置與 Accessibility：
  - 各輸入元件皆具備明確的 `aria-label` 或 `id`/`htmlFor` 標籤綁定。
  - 數值欄位指定 `type="number" min="0" step="1"`。
  - 辦理日期指定 `type="date"`。
- 樣式調整（`enrollmentBillingDetail.css`）：
  - 為編輯狀態下的輸入框提供適當的寬度、內距（padding）與邊框樣式，確保在 Grid 佈局中整齊對齊。

---

## 4. 驗證與錯誤處理 (Validation & Error Handling)

1. **金額欄位驗證**：
   - 空白字串或 null -> 轉為 `null`
   - 正整數或 0 -> 轉為整數
   - 負數或非數字字元 -> 拋出/顯示「金額必須為非負整數」錯誤
2. **文字欄位處理**：
   - 移除前後空格，若為空字串則轉為 `null`
3. **並行請求保護 (In-Flight Lock)**：
   - 使用 `isSaving` 與 `saveInFlight` ref 防止連點或多次送出。

---

## 5. 測試計畫 (Test Plan)

1. **單元測試 (`enrollmentService.test.js`)**：
   - 驗證 `updateEnrollmentBillingDetails` 格式化資料與呼叫 Supabase API 行為。
   - 驗證錯誤處理。
2. **元件測試 (`EnrollmentBillingDetailModal.test.jsx`)**：
   - 權限判斷：無權限不顯示編輯按鈕，有權限顯示。
   - 模式切換：點擊編輯進入編輯模式，點擊取消還原原始資料。
   - 動態計算：輸入各項費用時，正式費用合計欄位即時變更。
   - 儲存流程：驗證正常儲存、呼叫 API、觸發 onRefresh 與退出編輯模式。
   - 錯誤處理：輸入無效數值時阻擋儲存並顯示提示。
3. **整體回歸驗證**：
   - 執行全部 Vitest 測試套件。
   - 執行 `npm run build` 確認編譯成功。
