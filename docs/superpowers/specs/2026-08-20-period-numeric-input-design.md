# 修課期別純數字輸入設計規格（Period Numeric Input Design）

## 1. 背景與目標
在管理系統中，選課紀錄與報名資料的「修課期別」原先為開放文字輸入框（使用者可能輸入 `16`、`第16期` 等），預設值為 `第1期`。為了提升行政人員輸入效率與體驗，將相關表單中的「修課期別」調整為純數字輸入框，並在 UI 上以「第 [ 數字 ] 期」的形式直觀呈現。

## 2. 影響範圍
本變更套用至系統中所有涉及手動輸入／編輯期別的表單介面：
1. **新增選課紀錄 (`AddEnrollModal.jsx`)**
2. **新增會員與第一筆報名 (`InitialEnrollmentStep.jsx` / `AddStudentModal.jsx`)**
3. **編輯既有選課 (`EnrollmentEditForm.jsx`)**

## 3. 詳細規格與實作設計

### 3.1 樣式與組件結構 (`common.css`)
新增 `.period-input-group` 佈局樣式：
- 容器使用 `display: flex; align-items: center; gap: 8px;`
- 前綴 `.period-prefix` 顯示 `第`，後綴 `.period-suffix` 顯示 `期`
- 輸入框 `.period-number-input` 彈性填滿寬度 (`flex: 1`)，維持一致的邊框與聚焦樣式

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
}

.period-number-input {
  flex: 1;
}
```

### 3.2 表單元件調整

#### A. 新增選課紀錄 (`AddEnrollModal.jsx`)
- `initialEnrollmentState` 的 `period` 預設值改為純數字字串（若傳入 `defaultPeriod` 如 `第1期` 或 `1`，透過 `periodNumber` 解析為數字字串，例如 `'1'`）。
- 輸入框屬性：
  - `type="number"`
  - `min="1"`
  - `step="1"`
  - `inputMode="numeric"`
  - `placeholder="16"`
- 封裝在 `.period-input-group` 中，前後分別有 `第` 與 `期`。
- 送出時由 `normalizeInitialEnrollmentForm`（內部呼叫 `normalizePeriod`）自動轉為 `第N期`。

#### B. 新增會員第一筆報名 (`InitialEnrollmentStep.jsx`)
- 期別欄位封裝在 `.period-input-group` 中，前後顯示 `第` 與 `期`。
- 輸入框屬性設為 `type="number"`, `min="1"`, `step="1"`, `inputMode="numeric"`, `placeholder="16"`。
- 送出時由 `normalizeInitialEnrollmentForm` 轉換。

#### C. 編輯既有選課 (`EnrollmentEditForm.jsx`)
- 初始化狀態時，將 `enrollment.period`（如 `第16期`）透過 `periodNumber` 解析為純數字字串（如 `'16'`）。
- 期別欄位封裝在 `.period-input-group` 中，前後顯示 `第` 與 `期`。
- 儲存時由 `normalizePeriod` 將純數字轉為 `第N期` 傳給 RPC。

## 4. 資料轉換與相容性
- 現有的 `domain/period.js` 中的 `periodNumber` 與 `normalizePeriod` 已完全支援純數字字串（例如 `'16'` $\rightarrow$ `16` $\rightarrow$ `'第16期'`）。
- 資料庫 RPC 與存儲層皆維持 `第16期` 格式不變，完全向下相容。

## 5. 測試策略
1. 更新 `AddEnrollModal.test.jsx` 驗證期別輸入為純數字時能正確提交 `第16期`。
2. 更新 `InitialEnrollmentStep.test.jsx` 驗證期別欄位為 `number` 類型、具有 `min="1"` 限制與前後綴結構。
3. 更新 `EnrollmentEditForm.test.jsx` 驗證編輯時以純數字初始化並能正確儲存 `第16期`。
4. 執行全部單元測試以確保無回歸錯誤。
