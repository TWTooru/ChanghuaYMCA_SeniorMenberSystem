# 前端核心資料層維護性註解 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 React 應用程式入口、認證、hooks、domain、services 與匯出工具補上繁體中文維護性註解，讓接手者能沿著資料流理解責任、輸入輸出與非直覺決策。

**Architecture:** 註解沿用既有 `App/UI → hooks → services → domain → Supabase` 分層，不調整模組邊界。核心檔案使用模組摘要與精簡 JSDoc，權限、過期請求、資料正規化、legacy fallback 與錯誤轉換則使用鄰近的「為什麼」註解。

**Tech Stack:** React 19、JavaScript ESM、Supabase JS 2、Vitest 4、oxlint、Vite 8

## Global Constraints

- 註解使用繁體中文；程式識別字、資料表、欄位與錯誤碼保留原始英文並以反引號標示。
- 只新增或改善註解，不改動執行行為、函式簽章、畫面結果、測試斷言或依賴版本。
- 不逐行翻譯語法；明確 getter、直接資料映射與自明 JSX 不加註解。
- 不處理孤兒檔、重構、角色判定、bundle 大小或 CSS 清理。
- 不修改 `dist`、`node_modules`、第三方產物與一次性暫存檔。
- 保留工作樹現有的管理員帳號與 `架構.md` 變更；每次提交只能包含該任務列出的非重疊檔案。
- 若發現疑似 bug，只記錄為後續事項，不在本計畫修正。
- 所有 npm 指令從 repository root 執行，使用 `npm --prefix dashboard ...`。

## File Structure

| 區域 | 檔案 | 責任 |
|---|---|---|
| 應用程式組合 | `dashboard/src/App.jsx` | 串接登入狀態、全域資料、頁籤、modal 與 refresh trigger |
| 認證與環境 | `dashboard/src/contexts/AuthContext.jsx`, `dashboard/src/lib/supabaseClient.js` | 初始化 session、辨識密碼流程、解析角色與建立 Supabase client |
| UI 狀態 hooks | `dashboard/src/hooks/*.js` | 封裝資料載入、管理員操作、權限、統計、選取、匯出、主題與未儲存防護 |
| 純 domain | `dashboard/src/domain/*.js` | 正規化學員、季度、課程、帳務與匯入資料 |
| Supabase services | `dashboard/src/services/*.js` | 封裝 table、RPC、Edge Function 呼叫及穩定錯誤轉換 |
| 匯出工具 | `dashboard/src/lib/excelExport.js` | 將目前 dashboard 資料轉為多工作表 workbook |
| 複雜測試說明 | 指定的 `*.test.js(x)` | 解釋真實 fixture、競態測試與注入式 mock 的意圖 |

---

### Task 1: 應用程式入口、認證與前端權限邊界

**Files:**
- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/contexts/AuthContext.jsx`
- Modify: `dashboard/src/lib/supabaseClient.js`
- Modify: `dashboard/src/hooks/usePermissions.js`
- Modify: `dashboard/src/hooks/useTheme.js`

**Interfaces:**
- Consumes: Supabase auth session、`session.user.app_metadata`、Vite `import.meta.env`、瀏覽器 `localStorage`
- Produces: `AuthContext` 的 `session/user/role/passwordFlow`、前端顯示權限物件、`theme/toggleTheme`、共用 `supabase` client

- [ ] **Step 1: 執行現有入口、認證與設定測試，記錄行為基線**

Run:

```powershell
npm --prefix dashboard test -- src/App.test.jsx src/contexts/AuthContext.test.jsx src/lib/supabaseClient.test.js src/hooks/usePermissions.test.js src/hooks/useTheme.test.js
```

Expected: 5 個測試檔全部通過，沒有 snapshot 或 assertion 更新。

- [ ] **Step 2: 在模組責任與安全邊界旁加入下列註解**

在各檔案 import 之後、第一個宣告之前加入對應摘要；JSDoc 緊鄰指定函式：

```js
// App.jsx
/**
 * 應用程式組合根節點：依認證流程切換登入／設密碼畫面，登入後再串接
 * dashboard 資料、頁籤與跨頁共用 modal。`refreshCount` 是所有成功 mutation
 * 通知 `useApiData` 重新讀取 Supabase 快照的唯一入口。
 */

// AuthContext.jsx
/**
 * 集中管理 Supabase session 與邀請／密碼重設流程。
 * `role` 供前端控制顯示；真正授權仍必須由 RLS 或 Edge Function 驗證。
 */

/**
 * 從 session metadata 解析 UI 使用的角色；legacy metadata 僅為相容舊帳號。
 * 缺少或未知角色時一律降級為 `viewer`。
 */

// supabaseClient.js
/**
 * 驗證 Vite 注入的 Supabase public 設定並建立瀏覽器共用 client。
 * production 禁止沿用本機預設值，避免正式環境默默連到錯誤專案。
 */

// usePermissions.js
/**
 * 將角色映射為 UI 顯示與操作提示。這些旗標不是安全邊界，
 * 後端 mutation 仍由 RLS、RPC 或 Edge Function 再次授權。
 */

// useTheme.js
/**
 * 同步使用者主題偏好、`document.documentElement` 與 `localStorage`。
 * hook 只管理瀏覽器呈現狀態，不參與任何業務資料持久化。
 */
```

在 `App.jsx` 的非管理員頁籤修正 effect 前加入：

```js
// 角色可能在 session 更新後降級；立即退出管理頁，避免保留已失效的管理介面。
```

在 `AuthContext.jsx` 的 `user_metadata` fallback 附近加入：

```js
// `app_metadata` 由可信任後端維護；`user_metadata` 只保留舊帳號相容性，不能作為後端授權依據。
```

- [ ] **Step 3: 重跑相同測試**

Run:

```powershell
npm --prefix dashboard test -- src/App.test.jsx src/contexts/AuthContext.test.jsx src/lib/supabaseClient.test.js src/hooks/usePermissions.test.js src/hooks/useTheme.test.js
```

Expected: 全部通過；註解不改變登入分流、權限物件或主題切換。

- [ ] **Step 4: 檢查本任務 diff 只包含註解**

Run:

```powershell
git diff --check -- dashboard/src/App.jsx dashboard/src/contexts/AuthContext.jsx dashboard/src/lib/supabaseClient.js dashboard/src/hooks/usePermissions.js dashboard/src/hooks/useTheme.js
git diff --word-diff=porcelain -- dashboard/src/App.jsx dashboard/src/contexts/AuthContext.jsx dashboard/src/lib/supabaseClient.js dashboard/src/hooks/usePermissions.js dashboard/src/hooks/useTheme.js
```

Expected: `git diff --check` 無輸出；word diff 只出現 `//`、`/** ... */` 文字與其必要換行。

- [ ] **Step 5: 隔離提交本任務**

```powershell
git commit --only -m "docs: explain app authentication boundaries" -- dashboard/src/App.jsx dashboard/src/contexts/AuthContext.jsx dashboard/src/lib/supabaseClient.js dashboard/src/hooks/usePermissions.js dashboard/src/hooks/useTheme.js
```

Expected: commit 不包含原先已暫存的管理員帳號檔案或 `架構.md`。

### Task 2: 非同步資料生命週期與 UI 狀態 hooks

**Files:**
- Modify: `dashboard/src/hooks/useApiData.js`
- Modify: `dashboard/src/hooks/useAdminUsers.js`
- Modify: `dashboard/src/hooks/useAdminUsers.test.jsx`
- Modify: `dashboard/src/hooks/useStats.js`
- Modify: `dashboard/src/hooks/useExportHandler.js`
- Modify: `dashboard/src/hooks/useStudentSelection.js`
- Modify: `dashboard/src/hooks/useUnsavedChangesGuard.js`

**Interfaces:**
- Consumes: auth session、`refreshCount`、dashboard arrays、管理員 service functions、browser navigation events
- Produces: dashboard 載入狀態、管理員清單與 mutation 狀態、衍生統計、匯出 handler、穩定的學員選取與 dirty-state guard

- [ ] **Step 1: 執行 hooks 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/hooks/useApiData.test.jsx src/hooks/useAdminUsers.test.jsx src/hooks/useStats.test.js src/hooks/useExportHandler.test.js src/hooks/useStudentSelection.test.js src/hooks/useUnsavedChangesGuard.test.js
```

Expected: 6 個測試檔全部通過。

- [ ] **Step 2: 加入 hook 摘要與公開回傳契約**

```js
// useApiData.js
/**
 * 依登入 session 與 `refreshCount` 載入 dashboard 快照。
 * 失敗時清空個資陣列並回報 `offline`，避免畫面繼續顯示可能過期的資料。
 */

// useAdminUsers.js
/**
 * 協調管理員清單、audit log 與所有帳號 mutation。
 * request／generation ID 會阻擋過期回應覆寫較新的授權狀態；
 * `UNAUTHENTICATED` 或 `FORBIDDEN` 也會立即清除敏感資料。
 */

// useStats.js
/**
 * 從目前學員與報名快照計算純顯示統計，不讀寫遠端資料。
 * 回傳物件供 overview 卡片與圖表共用，避免各元件重複定義分組規則。
 */

// useExportHandler.js
/**
 * 將匯出對話框的季度與工作表選項套用到目前快照，
 * 再交由 `exportToExcel` 建立 workbook；此 hook 不重新查詢 Supabase。
 */

// useStudentSelection.js
/**
 * 以穩定的 `student_id` 保存選取狀態，並在資料刷新後替換為最新物件。
 * 同時集中管理學員明細的初始頁籤與是否顯示頁籤介面。
 */

// useUnsavedChangesGuard.js
/**
 * 統一管理表單 dirty state、瀏覽器離頁警告與 modal 關閉確認。
 * 呼叫端必須在每次成功儲存後清除 dirty state。
 */
```

- [ ] **Step 3: 在 `useAdminUsers` 競態位置補上決策原因**

把註解放在對應 ref 宣告與 guard 前，不重述算術操作：

```js
// `refreshId` 判斷資料新舊；`authorizationGeneration` 額外隔離權限失效前後的所有非同步工作。

// 敏感授權錯誤會推進 generation，讓較早啟動但較晚完成的成功回應全部失效。

// 以 operation ID 保存並行 mutation，較早完成的操作不能清除仍在執行中的 busy 狀態。
```

在 `useAdminUsers.test.jsx` 的「舊成功回應不得恢復敏感資料」及「並行 mutation」describe／test 前，各加入一句原因：

```js
// 這組案例鎖定授權失效後的競態，避免舊 request 把已清除的帳號資料寫回畫面。
// 這組案例驗證 busy state 跟隨最後一個仍在執行的 mutation，而不是最後一個啟動的 mutation。
```

- [ ] **Step 4: 重跑 hooks 測試**

Run:

```powershell
npm --prefix dashboard test -- src/hooks/useApiData.test.jsx src/hooks/useAdminUsers.test.jsx src/hooks/useStats.test.js src/hooks/useExportHandler.test.js src/hooks/useStudentSelection.test.js src/hooks/useUnsavedChangesGuard.test.js
```

Expected: 全部通過；競態測試的 assertion 完全不變。

- [ ] **Step 5: 檢查並提交**

```powershell
git diff --check -- dashboard/src/hooks
git diff --word-diff=porcelain -- dashboard/src/hooks
git commit --only -m "docs: explain frontend hook lifecycles" -- dashboard/src/hooks/useApiData.js dashboard/src/hooks/useAdminUsers.js dashboard/src/hooks/useAdminUsers.test.jsx dashboard/src/hooks/useStats.js dashboard/src/hooks/useExportHandler.js dashboard/src/hooks/useStudentSelection.js dashboard/src/hooks/useUnsavedChangesGuard.js
```

Expected: diff 只有註解；commit 僅包含列出的 hook 與測試檔。

### Task 3: 學員、季度、課程趨勢與帳務 domain

**Files:**
- Modify: `dashboard/src/domain/studentIdentity.js`
- Modify: `dashboard/src/domain/studentFields.js`
- Modify: `dashboard/src/domain/studentRelations.js`
- Modify: `dashboard/src/domain/season.js`
- Modify: `dashboard/src/domain/courseTrend.js`
- Modify: `dashboard/src/domain/enrollmentBilling.js`

**Interfaces:**
- Consumes: Supabase row-like objects、CSV/Excel 原始 scalar、enrollment timeline
- Produces: canonical student IDs、identity keys、normalized fields、排序後季度、課程趨勢與帳務摘要

- [ ] **Step 1: 執行純 domain 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/domain/studentIdentity.test.js src/domain/studentFields.test.js src/domain/studentRelations.test.js src/domain/season.test.js src/domain/courseTrend.test.js src/domain/enrollmentBilling.test.js
```

Expected: 6 個測試檔全部通過。

- [ ] **Step 2: 為公開 domain 函式加入精簡 JSDoc**

使用下列責任文字；同一檔案內彼此直接組合的簡單 helper 不重複說明：

```js
// studentIdentity.js
/** 將學員 ID 正規化為 canonical 十進位字串；空值是否允許由 `allowBlank` 決定。 */
/** 將身份比對日期正規化，供缺少可靠 ID 的匯入資料建立穩定比對鍵。 */
/** 以姓名與生日建立 fallback identity key；不得取代已存在的正式 `student_id`。 */

// studentFields.js
/** 將教育程度映射為系統固定選項，未知值保留為空值而不猜測分類。 */
/** 依指定基準日計算實足年齡；注入 `today` 讓匯入與測試結果可重現。 */
/** 將多種課程欄位格式拆成去空白的課程名稱陣列。 */

// studentRelations.js
/** 使用字串化 `student_id` 連結學員與報名，兼容資料來源中的數字／字串型別差異。 */

// season.js
/** 從阿拉伯數字或中文季度名稱擷取季度序號，無法辨識時回傳 `null`。 */
/** 將季度值轉為 canonical `第N季`，供排序、匯入與 UI 共用。 */
/** 依季度序號排序；無法辨識的值固定排在可辨識季度之後。 */

// courseTrend.js
/** 將報名 timeline 聚合為依季度排序的課程變化，供學員趨勢圖使用。 */

// enrollmentBilling.js
/** 將 nested course／receipt rows 轉為 UI 使用的 `courseDetails`，每門課只取目前單筆收據。 */
/** 彙總報名層 legacy 帳務與逐課收據，產生畫面共用的付款摘要。 */
```

在 `enrollmentBilling.js` 的 legacy fallback 附近加入：

```js
// 舊資料可能只有 enrollment 層 `amount`／`invoice_number`；逐課收據不存在時才使用此 fallback。
```

- [ ] **Step 3: 重跑 domain 測試並檢查 diff**

Run:

```powershell
npm --prefix dashboard test -- src/domain/studentIdentity.test.js src/domain/studentFields.test.js src/domain/studentRelations.test.js src/domain/season.test.js src/domain/courseTrend.test.js src/domain/enrollmentBilling.test.js
git diff --check -- dashboard/src/domain
git diff --word-diff=porcelain -- dashboard/src/domain/studentIdentity.js dashboard/src/domain/studentFields.js dashboard/src/domain/studentRelations.js dashboard/src/domain/season.js dashboard/src/domain/courseTrend.js dashboard/src/domain/enrollmentBilling.js
```

Expected: 測試全部通過；diff 只增加 JSDoc 與 legacy 原因註解。

- [ ] **Step 4: 隔離提交**

```powershell
git commit --only -m "docs: document frontend domain rules" -- dashboard/src/domain/studentIdentity.js dashboard/src/domain/studentFields.js dashboard/src/domain/studentRelations.js dashboard/src/domain/season.js dashboard/src/domain/courseTrend.js dashboard/src/domain/enrollmentBilling.js
```

Expected: commit 只包含本任務六個 domain 檔案。

### Task 4: CSV／Excel 匯入 domain 與預覽邊界

**Files:**
- Modify: `dashboard/src/domain/excelImport.js`
- Modify: `dashboard/src/domain/quarterCsvImport.js`
- Modify: `dashboard/src/domain/quarterCsvImport.acceptance.test.js`
- Modify: `dashboard/src/services/importPreviewService.js`
- Modify: `dashboard/src/services/dataImportService.js`

**Interfaces:**
- Consumes: browser `File`、SheetJS workbook/rows、目前 Supabase 學員與報名快照
- Produces: validated parsed payload、preview classification、`import_season_data` RPC payload/result、穩定中文錯誤

- [ ] **Step 1: 執行匯入流程測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/domain/excelImport.test.js src/domain/quarterCsvImport.test.js src/domain/quarterCsvImport.acceptance.test.js src/services/importPreviewService.test.js src/services/dataImportService.test.js
```

Expected: 5 個測試檔全部通過。

- [ ] **Step 2: 加入解析、預覽與提交的責任註解**

```js
// excelImport.js
/**
 * 提供 workbook 欄位的底層正規化與防護；不決定資料庫中的新增／更新分類。
 * 日期輸出固定為匯入 RPC 接受的格式，無效或空白值回傳 `null`。
 */
/** 在解析 rows 前限制檔案大小、工作表數與總列數，避免瀏覽器處理失控的 workbook。 */

// quarterCsvImport.js
/**
 * 將已核准的季度 CSV 欄位轉為學生與報名 payload。
 * 結果保留來源列號，讓預覽錯誤與 RPC 指派的新學員 ID 能回溯原始資料。
 */

// importPreviewService.js
/**
 * 將 parsed import 與資料庫快照比對，分類新增、更新、未變更與警告。
 * 此階段不寫入資料庫；分類結果會原封不動交給確認畫面與提交 service。
 */

// dataImportService.js
/**
 * 匯入流程邊界：`prepareImport` 負責讀檔、驗證與載入預覽；
 * `commitImport` 僅把已確認 preview 轉交 `import_season_data` RPC。
 */
```

在 `classifyImport` 的身份比對與 snapshot comparison 前加入：

```js
// 優先使用正式 `student_id`；缺少 ID 的新資料才使用 domain 產生的 identity key 比對。
// 先對 canonical payload 做快照比較，避免只因空白、日期格式或課程順序不同而誤判為更新。
```

在 `quarterCsvImport.acceptance.test.js` 的 fixture test 前加入：

```js
// 此 fixture 鎖定行政端核准的真實欄位格式與固定基準日，避免 parser 改動只在合成資料上通過。
```

- [ ] **Step 3: 重跑匯入測試**

Run:

```powershell
npm --prefix dashboard test -- src/domain/excelImport.test.js src/domain/quarterCsvImport.test.js src/domain/quarterCsvImport.acceptance.test.js src/services/importPreviewService.test.js src/services/dataImportService.test.js
```

Expected: 全部通過；fixture、RPC payload 與錯誤文字 assertion 不變。

- [ ] **Step 4: 檢查並提交**

```powershell
git diff --check -- dashboard/src/domain/excelImport.js dashboard/src/domain/quarterCsvImport.js dashboard/src/domain/quarterCsvImport.acceptance.test.js dashboard/src/services/importPreviewService.js dashboard/src/services/dataImportService.js
git diff --word-diff=porcelain -- dashboard/src/domain/excelImport.js dashboard/src/domain/quarterCsvImport.js dashboard/src/domain/quarterCsvImport.acceptance.test.js dashboard/src/services/importPreviewService.js dashboard/src/services/dataImportService.js
git commit --only -m "docs: explain import preparation boundaries" -- dashboard/src/domain/excelImport.js dashboard/src/domain/quarterCsvImport.js dashboard/src/domain/quarterCsvImport.acceptance.test.js dashboard/src/services/importPreviewService.js dashboard/src/services/dataImportService.js
```

Expected: diff 只有註解；commit 不包含其他 service 或使用者既有變更。

### Task 5: Dashboard、學員、報名、課程與管理員 services

**Files:**
- Modify: `dashboard/src/services/dashboardDataService.js`
- Modify: `dashboard/src/services/studentService.js`
- Modify: `dashboard/src/services/enrollmentService.js`
- Modify: `dashboard/src/services/courseCatalogService.js`
- Modify: `dashboard/src/services/courseReceiptService.js`
- Modify: `dashboard/src/services/adminUserService.js`

**Interfaces:**
- Consumes: 注入式 Supabase client（管理員 service 除外）、domain-normalized form data
- Produces: dashboard snapshot、student/enrollment/catalog/receipt mutation results、Edge Function stable errors

- [ ] **Step 1: 執行 service 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/services/dashboardDataService.test.js src/services/studentService.test.js src/services/enrollmentService.test.js src/services/courseCatalogService.test.js src/services/courseReceiptService.test.js src/services/adminUserService.test.js
```

Expected: 6 個測試檔全部通過。

- [ ] **Step 2: 為每個 service 加入資料邊界摘要**

```js
// dashboardDataService.js
/**
 * 平行讀取 `students` 與 nested `enrollments → courses → course_receipts`，
 * 再轉為 dashboard 共用快照；任何查詢失敗都拒絕整份快照，避免顯示半套資料。
 */

// studentService.js
/**
 * 封裝學員新增、更新與刪除。client 由呼叫端注入以便測試；
 * 更新透過 `update_student_profile` RPC 維持 ID 變更時的關聯一致性。
 */

// enrollmentService.js
/**
 * 封裝報名及課程關聯 mutation。建立與更新前先正規化課程名稱，
 * 跨表更新交由 RPC／資料庫交易維持原子性。
 */

// courseCatalogService.js
/**
 * 封裝 `course_catalog` 查詢與 mutation；新增使用 `upsert_course_catalog`
 * RPC，讓名稱去重與重新啟用規則由資料庫統一執行。
 */

// courseReceiptService.js
/**
 * 封裝 `course_receipts` 的單筆收據 CRUD，並把資料庫 row 映射為 UI billing shape。
 * 已知 constraint／policy 錯誤會轉為穩定中文訊息，其餘錯誤保留原始例外。
 */

// adminUserService.js
/**
 * 呼叫 `admin-users` Edge Function 並只暴露穩定錯誤碼。
 * 此模組使用全域 Supabase client 取得目前 access token，因此不支援 client 注入。
 */
```

為各公開 service function 加入單行 JSDoc，明確標示 table／RPC／Edge action，例如：

```js
/** 讀取 dashboard 所需完整快照，回傳 `{ students, enrollments }`。 */
/** 呼叫 `update_student_profile`，可同時更新學員欄位與正式 `student_id`。 */
/** 呼叫 `update_enrollment_with_courses`，以單一交易更新報名與課程集合。 */
/** 呼叫 `admin-users` 的 `delete_user` action；`confirmEmail` 由後端再次比對。 */
```

在 `adminUserService.js` 的 fallback error 旁保留既有安全意圖，將英文改善為：

```js
// 未知 transport／Supabase 細節不回傳 UI，避免洩漏內部資訊並維持可判斷的錯誤碼。
```

- [ ] **Step 3: 重跑 service 測試**

Run:

```powershell
npm --prefix dashboard test -- src/services/dashboardDataService.test.js src/services/studentService.test.js src/services/enrollmentService.test.js src/services/courseCatalogService.test.js src/services/courseReceiptService.test.js src/services/adminUserService.test.js
```

Expected: 全部通過；Supabase query、RPC 名稱、payload 與 error assertion 不變。

- [ ] **Step 4: 檢查並提交**

```powershell
git diff --check -- dashboard/src/services
git diff --word-diff=porcelain -- dashboard/src/services/dashboardDataService.js dashboard/src/services/studentService.js dashboard/src/services/enrollmentService.js dashboard/src/services/courseCatalogService.js dashboard/src/services/courseReceiptService.js dashboard/src/services/adminUserService.js
git commit --only -m "docs: document Supabase service contracts" -- dashboard/src/services/dashboardDataService.js dashboard/src/services/studentService.js dashboard/src/services/enrollmentService.js dashboard/src/services/courseCatalogService.js dashboard/src/services/courseReceiptService.js dashboard/src/services/adminUserService.js
```

Expected: commit 只包含六個 service 實作檔。

### Task 6: Excel 匯出工具與前端核心整體驗證

**Files:**
- Modify: `dashboard/src/lib/excelExport.js`
- Modify: `dashboard/src/lib/excelExport.test.js`

**Interfaces:**
- Consumes: students、enrollments、course data、filename、sheet selection options
- Produces: 下載用 SheetJS workbook；無可輸出工作表時建立 fallback 工作表

- [ ] **Step 1: 執行匯出測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/lib/excelExport.test.js
```

Expected: 測試通過。

- [ ] **Step 2: 將既有逐步註解改為可維護的責任註解**

在 `exportToExcel` 前加入：

```js
/**
 * 依 options 將目前 dashboard 快照轉成統計、學員、報名與課程工作表並觸發下載。
 * 保留舊呼叫端的 filename/options 參數交換相容性；至少建立一張工作表以避免 SheetJS 空 workbook 例外。
 */
```

把 `// 1.` 到 `// 4.` 改成繁體中文工作表區塊標題；把欄位旁「原本／改成」歷史敘述改為：

```js
// 報名工作表以 `enrollment_id` 作為可追溯編號，姓名僅供人工辨識。
// SheetJS 無法寫出零工作表 workbook；全部選項關閉時建立說明頁。
```

在 `excelExport.test.js` 模擬空 workbook 的測試前加入：

```js
// 這個 mock 刻意讓所有工作表選項關閉，鎖定 SheetJS 的空 workbook 防護。
```

- [ ] **Step 3: 執行匯出測試與完整前端驗證**

Run:

```powershell
npm --prefix dashboard test -- src/lib/excelExport.test.js
npm --prefix dashboard run lint
npm --prefix dashboard test
npm --prefix dashboard run build
```

Expected: 匯出測試及完整測試套件通過；lint exit code 為 0；build 成功。既有非阻斷警告可保留，但不得新增警告。

- [ ] **Step 4: 檢查並提交匯出註解**

```powershell
git diff --check -- dashboard/src/lib/excelExport.js dashboard/src/lib/excelExport.test.js
git diff --word-diff=porcelain -- dashboard/src/lib/excelExport.js dashboard/src/lib/excelExport.test.js
git commit --only -m "docs: clarify workbook export flow" -- dashboard/src/lib/excelExport.js dashboard/src/lib/excelExport.test.js
```

Expected: commit 只包含匯出工具與其測試註解。

- [ ] **Step 5: 確認使用者原有暫存內容仍在**

Run:

```powershell
git diff --cached --name-only
```

Expected: 原先的 `dashboard/src/components/admin/AdminAccountPage.jsx`、`dashboard/src/components/admin/AdminAccountPage.test.jsx`、三個 `supabase/functions/admin-users` 檔案與 `架構.md` 仍保留其原有暫存狀態，沒有被前端核心提交帶走。
