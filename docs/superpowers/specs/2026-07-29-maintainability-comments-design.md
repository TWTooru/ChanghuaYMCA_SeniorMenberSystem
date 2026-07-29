# 全專案維護性註解設計

**日期：** 2026-07-29  
**狀態：** 已核准  
**範圍：** React 前端、Supabase Edge Functions、重要 SQL migrations

## 目標

讓熟悉 React 與 Supabase 的工程師接手後，可以在打開檔案或閱讀重要區塊時，快速回答下列問題：

- 這個模組負責什麼？
- 它接收與產出哪些主要資料？
- 它依賴哪些相鄰模組或後端能力？
- 非直覺的權限、競態、正規化或相容邏輯為什麼存在？
- 修改時有哪些不可破壞的前提？

註解使用繁體中文，程式識別字、資料表、欄位與錯誤碼保留原始英文並以反引號標示。

## 非目標

- 不逐行翻譯 JavaScript、TypeScript、CSS 或 SQL 語法。
- 不為明確的 getter、單純 JSX 排版或直接資料映射加入贅述。
- 不改動執行行為、函式簽章、SQL 效果、畫面結果或測試斷言。
- 不在本工作中順便清除孤兒檔、重構模組、調整權限或改善 bundle。
- 不修改 `dist`、`node_modules`、第三方產物與一次性暫存檔。

## 註解層級

### 1. 模組摘要

對具備獨立責任的核心檔案加入檔頭摘要，內容保持在數行內，說明：

- 模組責任；
- 主要上游與下游；
- 需要特別留意的狀態或安全邊界。

純展示元件只需要一句責任摘要；名稱與內容已完全自明的檔案不強制加入檔頭。

### 2. 對外介面 JSDoc

對 domain、service、hook 與共用工具中的主要對外函式加入精簡 JSDoc。視需要記錄：

- 參數代表的業務資料；
- 回傳值與非同步結果；
- 正規化規則；
- 可能拋出的穩定錯誤；
- 呼叫端必須維持的前置條件。

JSDoc 不重複型別可直接看出的資訊，也不替每個 React component prop 建立冗長表格。

### 3. 區塊與決策註解

只在程式碼無法自行表達意圖時加入行內或區塊註解，重點解釋「為什麼」，例如：

- 以 generation ID 或 request ID 忽略過期非同步結果；
- 為何角色必須由可信任的 metadata 或後端再次驗證；
- 為何匯入資料需要先正規化、快照比對再提交；
- 為何保留 legacy 欄位 fallback；
- 為何更新或刪除前需要額外確認；
- 為何使用 advisory lock、transaction、trigger 或特定 RLS policy。

禁止加入只重述下一行程式碼的註解。

## 各層覆蓋範圍

### 應用程式、contexts 與 hooks

- `App.jsx`：登入後資料流、頁籤狀態、全域 modal 與 refresh trigger 的關係。
- `AuthContext.jsx`：session 初始化、密碼設定流程與角色來源。
- `useApiData`、`useAdminUsers`：載入生命週期、刷新策略、過期請求與敏感錯誤處理。
- `useStats`、`useExportHandler`、`useStudentSelection`、`useUnsavedChangesGuard`：各 hook 的單一責任與狀態邊界。
- `usePermissions`、`useTheme`：前端顯示控制與真正後端授權的差異。

### Domain 與 services

- Domain 函式說明純邏輯責任、正規化格式、身份比對鍵、季度排序與帳務摘要規則。
- Service 函式說明對應的 Supabase table／RPC／Edge Function、輸入資料格式與錯誤轉換。
- 匯入與匯出流程說明解析、預覽、提交及 workbook 產生的邊界。
- client 注入的 service 說明可測試性目的；使用全域 client 的模組說明其限制。

### React components

優先處理具備狀態協調或業務流程的元件：

- CSV 匯入、匯出選項與預覽；
- 學員列表、學員明細、編輯與未儲存防護；
- 報名歷程、帳務明細、課程收據與課程目錄；
- 管理員帳號、邀請、刪除與 audit log。

純圖表與展示元件只補充計算方法或互動狀態；不為一般 JSX 標籤增加說明。

### Supabase Edge Functions

- `domain.ts`：輸入白名單、角色驗證、穩定錯誤碼與安全輸出。
- `handler.ts`：request 驗證順序、fresh actor 驗證、mutation 與 audit 的關係。
- `index.ts`：環境變數來源、Supabase adapter、外部錯誤轉換與 CORS 邊界。
- 測試只補充複雜安全案例、競態案例與 mock adapter 的意圖。

### SQL migrations

每份 migration 至少保留清楚的目的摘要；對重要 migration 另外說明：

- 前置 schema、function 或舊 migration 依賴；
- RLS policy 對各角色允許的操作；
- transaction／advisory lock 防止的競態；
- trigger、cascade 與資料一致性目的；
- legacy production repair 或向下相容原因；
- migration 已套用後不得從歷史中刪除。

註解不得暗示 migration 可以安全回滾，除非檔案本身確實提供可驗證的回滾路徑。

### 測試與 CSS

- 測試只為複雜 fixture、非直覺 mock、競態及安全性案例補充原因。
- 測試名稱已完整描述行為時不再加同義註解。
- CSS 保留或改善區塊標題；只為跨元件共用、特殊 stacking context、focus trap 配套或響應式限制補充原因。

## 變更隔離

- 本工作只新增或改善註解。
- 保留目前工作樹中管理員帳號與 `架構.md` 的既有變更。
- 不將註解工作與已發現的角色判定、bundle、孤兒檔或 CSS 清理混在同一批變更。
- 若閱讀時發現疑似 bug，只記錄為後續事項，不在註解工作中修正。

## 驗證

完成後執行：

1. `git diff --check`，確認沒有新增格式問題。
2. 人工檢查 diff，確認非註解 token、函式簽章、SQL statement、測試斷言與樣式宣告均未改動。
3. `npm run lint`。
4. `npm test`。
5. `npm run build`。
6. `deno test supabase/functions/admin-users`。

SQL migration 只新增註解，不需要套用至 linked database；仍需確認每個 SQL statement 的文字與順序未被改動。

## 驗收標準

- 核心模組能在檔案開頭或主要對外介面附近看出職責。
- 非直覺的權限、競態、正規化、相容與交易邏輯都有原因說明。
- 註解不重述語法、不承諾未經驗證的行為，也不包含容易過期的數量或行號。
- 正式程式行為與測試結果維持不變。
- 現有使用者變更不被覆寫或混入註解工作。
