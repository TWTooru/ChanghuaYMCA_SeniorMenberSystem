# 前端畫面流程維護性註解 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為具備狀態協調或業務流程的 React components 與相關 CSS 補上繁體中文維護性註解，使工程師能理解 modal、表格、匯入、學員、報名、帳務與管理員畫面的責任。

**Architecture:** 元件註解聚焦在流程邊界、狀態所有權與無障礙互動，不替 JSX 逐標籤翻譯。純展示圖表只說明計算或 hover state；CSS 只保留清楚區塊標題與必要 stacking／responsive 原因。

**Tech Stack:** React 19、Lucide React、SweetAlert2、SheetJS、CSS、Vitest、Testing Library

## Global Constraints

- 註解使用繁體中文；程式識別字、資料表、欄位與錯誤碼保留原始英文並以反引號標示。
- 只新增或改善註解，不改動 props、state、event handler、JSX、CSS declaration、畫面結果或測試斷言。
- 純展示元件只加一句責任摘要；自明 UI primitives 不修改。
- 不處理 CSS 清理、元件拆分、視覺改版、孤兒檔或 bundle 大小。
- 不修改 `dashboard/src/components/ui/*`，其 shadcn-style primitives 已由名稱與 API 清楚表意。
- 保留工作樹現有的 `AdminAccountPage.jsx` 與 `AdminAccountPage.test.jsx` 變更；這兩個檔案的註解只留在 unstaged working tree，不提交。
- 所有 npm 指令從 repository root 執行，使用 `npm --prefix dashboard ...`。

## File Structure

| 流程 | 主要檔案 | 狀態邊界 |
|---|---|---|
| 認證與共用 shell | `components/auth/*`, `components/common/*` | 表單提交、密碼流程、header actions、確認對話框 |
| 匯入／匯出 | `components/sync/*` | 選檔、preview、commit、focus trap、workbook options |
| 學員 | `components/students/*` | 篩選、排序、分頁、detail/edit dirty state |
| 報名與帳務 | `components/enrollment/*` | 課程集合、歷程、編輯、收據 CRUD、catalog |
| 管理員 | `components/admin/*` | UI guard、邀請、角色、刪除確認、audit list |
| Overview | `components/overview/*` | 衍生統計與 hover-only chart state |
| Styles | 各區域 `*.css` | 區塊責任、overlay stacking、共用 modal 與 responsive 限制 |

---

### Task 1: 認證畫面、共用 header 與確認對話框

**Files:**
- Modify: `dashboard/src/components/auth/Login.jsx`
- Modify: `dashboard/src/components/auth/PasswordSetup.jsx`
- Modify: `dashboard/src/components/common/AppHeader.jsx`
- Modify: `dashboard/src/components/common/ConfirmDialog.jsx`
- Modify: `dashboard/src/components/auth/auth.css`
- Modify: `dashboard/src/components/common/common.css`

**Interfaces:**
- Consumes: Supabase auth methods、`useAuth` 提供的狀態、header action callbacks
- Produces: 登入／設密碼提交、全域操作入口與可重用刪除確認 UI

- [ ] **Step 1: 執行認證 component 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/components/auth/Login.test.jsx src/components/auth/PasswordSetup.test.jsx
```

Expected: 2 個測試檔全部通過。

- [ ] **Step 2: 加入元件責任摘要與流程原因**

```jsx
// Login.jsx
/**
 * 登入畫面只負責建立 Supabase email/password session；
 * 成功後的路由與 dashboard 顯示由 `AuthContext`／`App` 接手。
 */

// PasswordSetup.jsx
/**
 * 處理 invite 與 recovery 共用的首次設密碼表單。
 * 成功後呼叫 `onComplete` 清除 URL flow，避免重新整理再次進入設定畫面。
 */

// AppHeader.jsx
/** 集中呈現連線狀態、依權限顯示的全域操作、使用者資訊與主題／登出控制。 */

// ConfirmDialog.jsx
/** 可重用的破壞性操作確認層；是否允許操作仍由呼叫端與後端決定。 */
```

把 `Login.jsx` 中偏視覺行銷語氣的 JSX 註解改為：

```jsx
{/* 裝飾背景，不承載互動或可讀內容。 */}
{/* 登入表單主容器。 */}
```

把 `auth.css` 與 `common.css` 的英文檔頭改為：

```css
/* 邀請與密碼重設共用的設密碼畫面。 */
/* 新增學員、報名與確認流程共用的 modal 基礎樣式。 */
```

- [ ] **Step 3: 重跑測試、檢查並提交**

Run:

```powershell
npm --prefix dashboard test -- src/components/auth/Login.test.jsx src/components/auth/PasswordSetup.test.jsx
git diff --check -- dashboard/src/components/auth dashboard/src/components/common
git diff --word-diff=porcelain -- dashboard/src/components/auth dashboard/src/components/common
git commit --only -m "docs: explain authentication UI flow" -- dashboard/src/components/auth/Login.jsx dashboard/src/components/auth/PasswordSetup.jsx dashboard/src/components/common/AppHeader.jsx dashboard/src/components/common/ConfirmDialog.jsx dashboard/src/components/auth/auth.css dashboard/src/components/common/common.css
```

Expected: 測試通過；commit 只包含註解與 CSS comment。

### Task 2: CSV 匯入、預覽與匯出選項

**Files:**
- Modify: `dashboard/src/components/sync/ExcelSync.jsx`
- Modify: `dashboard/src/components/sync/ExcelSync.test.jsx`
- Modify: `dashboard/src/components/sync/ImportPreviewDialog.jsx`
- Modify: `dashboard/src/components/sync/ImportPreviewDialog.test.jsx`
- Modify: `dashboard/src/components/sync/ExportOptionsDialog.jsx`
- Modify: `dashboard/src/components/sync/ExportOptionsDialog.test.jsx`
- Modify: `dashboard/src/components/sync/sync.css`

**Interfaces:**
- Consumes: `prepareImport`／`commitImport`、preview object、enrollments、export callbacks
- Produces: import confirmation、assigned ID result、focus-contained dialogs、normalized export options

- [ ] **Step 1: 執行 sync component 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/components/sync/ExcelSync.test.jsx src/components/sync/ImportPreviewDialog.test.jsx src/components/sync/ExportOptionsDialog.test.jsx
```

Expected: 3 個測試檔全部通過。

- [ ] **Step 2: 加入三個流程元件的摘要**

```jsx
// ExcelSync.jsx
/**
 * CSV 匯入協調元件：選檔後只建立 preview，使用者確認後才提交 RPC。
 * 成功回傳的 `assigned_ids` 另以 portal 顯示，避免刷新資料時遺失新 ID 對照。
 */

// ImportPreviewDialog.jsx
/**
 * 顯示匯入前的新增／更新／未變更摘要與警告。
 * dialog 不重新解析資料；確認時把原 preview 交回上層提交。
 */

// ExportOptionsDialog.jsx
/**
 * 收集匯出範圍與工作表選項，將季度篩選結果交給上層匯出 hook。
 * 自行管理 focus trap 與 Escape，避免鍵盤焦點離開 modal。
 */
```

在 `ExcelSync` 的 input reset、preview/commit 分界與 portal 前加入：

```jsx
// 重設原生 input，讓使用者選取同一檔案時仍會觸發下一次 `change`。
// preview 成功不代表已寫入；只有 `handleConfirm` 會呼叫 mutation RPC。
// 指派 ID 必須在資料刷新後仍可抄錄，因此使用獨立於 preview 的結果狀態。
```

將 `ImportPreviewDialog.jsx` 的 `Process warnings` 等英文步驟註解替換為：

```jsx
// 將 parser 與 snapshot 警告整理成單一顯示序列，不改動 preview 原始資料。
// 若沒有更精確的空資料庫警告，補上一般覆寫提醒並置於最前方。
```

將 `ExportOptionsDialog.jsx` 的編號式註解替換為：

```jsx
// 季度清單沿用 domain 排序，確保選項順序與其他畫面一致。
// focus trap 只在 dialog 存在期間註冊，關閉時移除全域 keydown listener。
```

- [ ] **Step 3: 只為非直覺測試補充原因**

```jsx
// ExcelSync.test.jsx：preview 與 commit 分開 mock，確保讀檔階段不會提前寫入。
// ImportPreviewDialog.test.jsx：警告順序是行政確認流程的一部分，因此鎖定顯示優先序。
// ExportOptionsDialog.test.jsx：以首尾 focusable element 驗證 Tab／Shift+Tab 循環，不依賴 DOM 實作細節。
```

只把以上文字放在對應 describe 或 focus-trap test 前；刪除逐操作的 `Initially`、`Tab`、`Verify` 英文註解。

- [ ] **Step 4: 將 `sync.css` 區塊標題改為實際用途**

```css
/* 匯入按鈕、預覽與結果對話框共用樣式。 */
/* 程式碼／欄位提示區的等寬文字呈現。 */
/* 匯入警告與錯誤摘要。 */
/* 欄位結構提示樹。 */
```

不得改動任何 selector 或 declaration。

- [ ] **Step 5: 重跑測試、檢查並提交**

Run:

```powershell
npm --prefix dashboard test -- src/components/sync/ExcelSync.test.jsx src/components/sync/ImportPreviewDialog.test.jsx src/components/sync/ExportOptionsDialog.test.jsx
git diff --check -- dashboard/src/components/sync
git diff --word-diff=porcelain -- dashboard/src/components/sync
git commit --only -m "docs: explain import and export dialogs" -- dashboard/src/components/sync/ExcelSync.jsx dashboard/src/components/sync/ExcelSync.test.jsx dashboard/src/components/sync/ImportPreviewDialog.jsx dashboard/src/components/sync/ImportPreviewDialog.test.jsx dashboard/src/components/sync/ExportOptionsDialog.jsx dashboard/src/components/sync/ExportOptionsDialog.test.jsx dashboard/src/components/sync/sync.css
```

Expected: 測試通過；JSX 與 CSS 非註解 token 不變。

### Task 3: 學員清單、明細、編輯與 dirty-state 流程

**Files:**
- Modify: `dashboard/src/components/students/AddStudentModal.jsx`
- Modify: `dashboard/src/components/students/StudentListTab.jsx`
- Modify: `dashboard/src/components/students/StudentTable.jsx`
- Modify: `dashboard/src/components/students/StudentFilters.jsx`
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Modify: `dashboard/src/components/students/StudentEditForm.jsx`
- Modify: `dashboard/src/components/students/StudentInfoView.jsx`
- Modify: `dashboard/src/components/students/StudentCourseTrend.jsx`
- Modify: `dashboard/src/components/students/StudentDetailComponents.test.jsx`
- Modify: `dashboard/src/components/students/StudentDetailForms.test.jsx`
- Modify: `dashboard/src/components/students/students.css`

**Interfaces:**
- Consumes: student/enrollment snapshots、student services、selection callbacks、`useUnsavedChangesGuard`
- Produces: filtered/paginated rows、modal edit lifecycle、updated selected student、course trend display

- [ ] **Step 1: 執行學員 component 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/components/students/StudentListTab.test.jsx src/components/students/StudentDetailComponents.test.jsx src/components/students/StudentDetailForms.test.jsx src/components/students/StudentCourseTrend.test.jsx
```

Expected: 4 個測試檔全部通過。

- [ ] **Step 2: 加入元件摘要**

```jsx
// AddStudentModal.jsx
/** 建立單一學員並在成功後通知 dashboard 重讀；建議 ID 只協助輸入，最終仍由資料庫驗證。 */

// StudentListTab.jsx
/** 擁有學員搜尋、排序與分頁狀態，將實際 row rendering 與選取事件交給 `StudentTable`。 */

// StudentTable.jsx
/** 呈現目前頁面的學員資料；點擊與鍵盤操作都回傳完整 student 給上層選取流程。 */

// StudentFilters.jsx
/** 將搜尋與分類條件呈現為 controlled inputs，不自行篩選或持有資料快照。 */

// StudentDetailModal.jsx
/**
 * 協調學員資料、報名歷程與編輯模式；dirty form 關閉前必須經確認。
 * `onStudentUpdated` 先替換目前選取物件，`onRefresh` 再同步全域快照。
 */

// StudentEditForm.jsx
/** 編輯學員基本資料，透過 `onDirtyChange` 把未儲存狀態交給 modal 統一防護。 */

// StudentInfoView.jsx
/** 唯讀呈現 canonical student fields；編輯入口是否顯示由上層權限與 callback 決定。 */

// StudentCourseTrend.jsx
/** 將 domain 產生的季度課程趨勢呈現為時間序列，不在元件內重新定義聚合規則。 */
```

在 `AddStudentModal` 掃描 legacy IDs 的 catch 旁保留並改善原因：

```jsx
// 歷史資料可能含無法正規化的 legacy ID；建議值忽略它們，但正式送出仍會完整驗證。
```

在 `StudentListTab` 排序處把語法重述改為：

```jsx
// ID 來源可能是字串或數字；可轉為數值時採數值排序，否則才退回字串比較。
```

在 `StudentDetailModal` 的 focus trap、dirty close 與 refresh/update 順序旁加入：

```jsx
// modal 自行循環鍵盤焦點，避免背景頁面在 dialog 開啟時收到操作。
// 編輯中所有離開路徑共用同一 guard，避免遮罩、Escape 與關閉按鈕行為不一致。
// 先更新 selected student 可避免全域重讀完成前短暫顯示舊資料。
```

- [ ] **Step 3: 精簡測試與 CSS 註解**

在 `StudentDetailComponents.test.jsx` 的 focus／dirty-state fixture 前加入：

```jsx
// 這組 fixture 同時提供可聚焦控制項與 dirty callback，用來鎖定 modal 的離開防護。
```

在 `StudentDetailForms.test.jsx` 的 service mock 前加入：

```jsx
// service 在此只驗證表單 payload 與成功／失敗協調，不重測 Supabase client。
```

將 `students.css` 英文區塊標題改為繁體中文：

```css
/* 學員搜尋與篩選面板。 */
/* 學員資料表與列互動。 */
/* 狀態與分類標籤。 */
/* 分頁與資料表摘要。 */
/* 學員明細側邊 modal；需高於主頁內容並保留內部捲動。 */
/* 學員資訊欄位網格。 */
/* 明細 modal 編輯模式操作列。 */
```

- [ ] **Step 4: 重跑測試、檢查並提交**

Run:

```powershell
npm --prefix dashboard test -- src/components/students/StudentListTab.test.jsx src/components/students/StudentDetailComponents.test.jsx src/components/students/StudentDetailForms.test.jsx src/components/students/StudentCourseTrend.test.jsx
git diff --check -- dashboard/src/components/students
git diff --word-diff=porcelain -- dashboard/src/components/students
git commit --only -m "docs: explain student UI state flow" -- dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/StudentListTab.jsx dashboard/src/components/students/StudentTable.jsx dashboard/src/components/students/StudentFilters.jsx dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentEditForm.jsx dashboard/src/components/students/StudentInfoView.jsx dashboard/src/components/students/StudentCourseTrend.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/components/students/StudentDetailForms.test.jsx dashboard/src/components/students/students.css
```

Expected: 測試通過；commit 只包含學員區註解。

### Task 4: 報名、課程目錄與逐課收據流程

**Files:**
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.jsx`
- Modify: `dashboard/src/components/enrollment/CourseCatalogManager.jsx`
- Modify: `dashboard/src/components/enrollment/CourseTagPicker.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTimeline.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx`
- Modify: `dashboard/src/components/enrollment/enrollment.css`
- Modify: `dashboard/src/components/enrollment/enrollmentBillingDetail.css`
- Modify: `dashboard/src/components/enrollment/coursePicker.css`

**Interfaces:**
- Consumes: selected student/enrollment、course catalog、enrollment/receipt services、permissions
- Produces: enrollment mutations、course selection、billing CRUD、timeline/detail interactions

- [ ] **Step 1: 執行報名 component 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/components/enrollment/AddEnrollModal.test.jsx src/components/enrollment/CourseTagPicker.test.jsx src/components/enrollment/EnrollmentTab.test.jsx src/components/enrollment/EnrollmentEditForm.test.jsx src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
```

Expected: 5 個測試檔全部通過。

- [ ] **Step 2: 加入流程元件摘要**

```jsx
// AddEnrollModal.jsx
/** 建立指定學員的季度報名與課程集合；成功後關閉表單並要求 dashboard 重讀。 */

// CourseCatalogManager.jsx
/** 管理可選課程目錄的新增與停用；modal focus trap 與 mutation busy state 在此集中處理。 */

// CourseTagPicker.jsx
/** 以受控課程名稱陣列呈現 catalog tags，並允許具權限者開啟目錄管理。 */

// EnrollmentTab.jsx
/** 擁有跨學員報名歷程的搜尋、季度篩選與分頁，選取後交由上層開啟帳務明細。 */

// EnrollmentTimeline.jsx
/** 呈現單一學員的季度報名；編輯、刪除與新增入口由上層權限決定。 */

// EnrollmentEditForm.jsx
/** 編輯一筆報名及其完整課程集合，儲存時交給交易型 service 同步關聯資料。 */

// EnrollmentBillingDetailModal.jsx
/**
 * 協調報名明細、逐課收據新增／編輯／刪除與 legacy 帳務顯示。
 * 所有成功 mutation 都透過 `onRefresh` 重新取得資料庫真實狀態。
 */
```

在 catalog 載入、課程集合、帳務 fallback 與刪除確認處加入：

```jsx
// catalog 是可選名稱來源，不等於此報名已選課程；表單仍以受控陣列為真實值。
// 儲存完整課程集合而非送增量，讓 RPC 能在同一交易中處理新增與移除。
// 無逐課收據的歷史報名才顯示 enrollment 層帳務，避免同一金額重複計算。
// 收據刪除會改變帳務摘要，必須先確認並在成功後重讀 nested receipt rows。
```

- [ ] **Step 3: 補充帳務測試與 CSS 的非直覺原因**

在 `EnrollmentBillingDetailModal.test.jsx` 的 create/edit/delete helper 前加入：

```jsx
// helper 先開啟指定課程的收據表單，讓各案例只聚焦 payload、busy state 與 refresh 結果。
```

在 legacy fallback 與刪除失敗案例前加入：

```jsx
// 此案例鎖定舊 enrollment 層帳務只在沒有逐課收據時出現。
// 刪除失敗時保留 modal 與原資料，避免 UI 假裝資料庫已完成 mutation。
```

將 CSS 補成下列區塊意圖：

```css
/* 報名時間線與行內編輯表單。 */
/* 帳務明細 modal：表頭固定、內容區獨立捲動，避免長課程列表推離操作列。 */
/* 課程 tag picker 與目錄管理 overlay；管理 overlay 必須高於報名表單。 */
```

- [ ] **Step 4: 重跑測試、檢查並提交**

Run:

```powershell
npm --prefix dashboard test -- src/components/enrollment/AddEnrollModal.test.jsx src/components/enrollment/CourseTagPicker.test.jsx src/components/enrollment/EnrollmentTab.test.jsx src/components/enrollment/EnrollmentEditForm.test.jsx src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
git diff --check -- dashboard/src/components/enrollment
git diff --word-diff=porcelain -- dashboard/src/components/enrollment
git commit --only -m "docs: explain enrollment billing flow" -- dashboard/src/components/enrollment/AddEnrollModal.jsx dashboard/src/components/enrollment/CourseCatalogManager.jsx dashboard/src/components/enrollment/CourseTagPicker.jsx dashboard/src/components/enrollment/EnrollmentTab.jsx dashboard/src/components/enrollment/EnrollmentTimeline.jsx dashboard/src/components/enrollment/EnrollmentEditForm.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx dashboard/src/components/enrollment/enrollment.css dashboard/src/components/enrollment/enrollmentBillingDetail.css dashboard/src/components/enrollment/coursePicker.css
```

Expected: 測試通過；commit 只包含報名區註解。

### Task 5: 管理員帳號畫面與既有 staged 變更隔離

**Files:**
- Modify but do not stage/commit: `dashboard/src/components/admin/AdminAccountPage.jsx`
- Modify but do not stage/commit: `dashboard/src/components/admin/AdminAccountPage.test.jsx`
- Modify: `dashboard/src/components/admin/AdminAuditLog.jsx`
- Modify: `dashboard/src/components/admin/InviteUserModal.jsx`
- Modify: `dashboard/src/components/admin/DeleteUserDialog.jsx`
- Modify: `dashboard/src/components/admin/admin.css`

**Interfaces:**
- Consumes: `useAuth` role/current user、`useAdminUsers` data/actions、stable error codes
- Produces: admin-only account list、invite/role/reset/delete operations、audit timeline

- [ ] **Step 1: 保存兩個重疊檔案的 staged／unstaged 基線**

Run:

```powershell
git diff --cached -- dashboard/src/components/admin/AdminAccountPage.jsx dashboard/src/components/admin/AdminAccountPage.test.jsx
git diff -- dashboard/src/components/admin/AdminAccountPage.jsx dashboard/src/components/admin/AdminAccountPage.test.jsx
npm --prefix dashboard test -- src/components/admin/AdminAccountPage.test.jsx
```

Expected: staged diff 顯示使用者既有功能變更；測試通過。不要執行 `git add`、`git commit --only` 或任何會把這兩個完整 working-tree 版本寫入 commit 的命令。

- [ ] **Step 2: 加入管理員畫面責任與雙層授權說明**

```jsx
// AdminAccountPage.jsx
/**
 * 管理員帳號流程入口：UI 先依 session role 隱藏操作，再由 `admin-users`
 * Edge Function 以 fresh actor 驗證每個 request；前端 guard 不是安全邊界。
 */

// AdminAuditLog.jsx
/** 將後端 audit row 呈現為時間序列；只顯示安全摘要，不推導操作是否真的完成。 */

// InviteUserModal.jsx
/** 收集邀請 Email；新帳號角色由後端固定為 `viewer`，不接受 UI 自行指定。 */

// DeleteUserDialog.jsx
/** 要求重新輸入目標 Email，後端仍會正規化並再次比對後才允許刪除。 */
```

在 `protectedUser` 與首次登入 guard 前加入：

```jsx
// 先在 UI 禁止自我操作與最後一位管理員降級，降低誤觸；後端與 DB trigger 仍會強制同一規則。
// 未完成首次登入的帳號尚未取得穩定 session metadata，因此角色變更由後端拒絕。
```

在 `AdminAccountPage.test.jsx` 的非 admin 直接渲染與保護最後管理員案例前加入：

```jsx
// 直接渲染頁面也必須有 UI guard，但此測試不取代 Edge Function 授權測試。
// 此案例驗證操作入口被停用；資料庫 trigger 才是並行 mutation 下的最終保護。
```

- [ ] **Step 3: 改善 admin CSS 標題**

```css
/* 管理員帳號摘要、列表與操作區。 */
/* Audit timeline 與帳號 mutation 操作按鈕。 */
```

- [ ] **Step 4: 重跑測試並分開檢查 staged/unstaged diff**

Run:

```powershell
npm --prefix dashboard test -- src/components/admin/AdminAccountPage.test.jsx
git diff --check -- dashboard/src/components/admin
git diff --cached -- dashboard/src/components/admin/AdminAccountPage.jsx dashboard/src/components/admin/AdminAccountPage.test.jsx
git diff -- dashboard/src/components/admin
```

Expected: 測試通過；cached diff 仍是原有 staged 版本，新增註解只出現在 working-tree diff。

- [ ] **Step 5: 只提交不重疊的管理員檔案**

```powershell
git commit --only -m "docs: explain admin account UI boundaries" -- dashboard/src/components/admin/AdminAuditLog.jsx dashboard/src/components/admin/InviteUserModal.jsx dashboard/src/components/admin/DeleteUserDialog.jsx dashboard/src/components/admin/admin.css
```

Expected: `AdminAccountPage.jsx` 與其測試不在 commit 中，兩檔註解保留為 unstaged changes。

### Task 6: Overview 圖表與全域 CSS 區塊

**Files:**
- Modify: `dashboard/src/components/overview/OverviewTab.jsx`
- Modify: `dashboard/src/components/overview/AgeDistributionChart.jsx`
- Modify: `dashboard/src/components/overview/CoursePopularityChart.jsx`
- Modify: `dashboard/src/components/overview/EducationDistributionChart.jsx`
- Modify: `dashboard/src/components/overview/KpiCards.jsx`
- Modify: `dashboard/src/components/overview/SeniorsMetricCard.jsx`
- Modify: `dashboard/src/components/overview/OverviewTab.test.jsx`
- Modify: `dashboard/src/components/overview/OverviewTab.css`
- Modify: `dashboard/src/App.css`
- Modify: `dashboard/src/index.css`

**Interfaces:**
- Consumes: `useStats` 產出的 counts/percentages、students
- Produces: 純展示 cards/charts 與 hover detail；不執行遠端 mutation

- [ ] **Step 1: 執行 overview 測試基線**

Run:

```powershell
npm --prefix dashboard test -- src/components/overview/OverviewTab.test.jsx
```

Expected: 測試通過。

- [ ] **Step 2: 為純展示元件加入最小責任摘要**

```jsx
// OverviewTab.jsx
/** 組合 `useStats` 產出的 KPI 與圖表，不在此重新計算資料規則。 */
// AgeDistributionChart.jsx
/** 顯示年齡分布 donut；hover state 只替換中央說明，不修改統計資料。 */
// CoursePopularityChart.jsx
/** 依既有排序顯示熱門課程比例；圓弧長度由 count 相對最大值計算。 */
// EducationDistributionChart.jsx
/** 顯示教育程度計數與總人數占比。 */
// KpiCards.jsx
/** 顯示 dashboard 核心 KPI。 */
// SeniorsMetricCard.jsx
/** 顯示 60 歲以上學員摘要，資料來源仍是傳入的 student snapshot。 */
```

把 `AgeDistributionChart.jsx` 的 `Active details` 改為：

```jsx
// hover 僅暫時取代中央文字；離開圖表後回復整體總數。
```

刪除 `CoursePopularityChart.jsx` 的近似圓周數值註解，因公式已自明且常數文字容易過期。

- [ ] **Step 3: 精簡 overview 測試註解並翻譯 CSS 區塊**

`OverviewTab.test.jsx` 只保留下列兩個原因註解，移除逐步操作重述：

```jsx
// 同一個中央摘要會在整體值與 hover slice/legend 值間切換。
// 空統計物件必須維持可渲染，避免資料載入初期圖表拋錯。
```

把 `OverviewTab.css`、`App.css`、`index.css` 的英文 section headings 翻譯成繁體中文；在 overlay/offline/global variables 區塊使用：

```css
/* KPI 摘要面板。 */
/* 圖表與概覽內容。 */
/* Donut 圖表與 hover 狀態。 */
/* 60 歲以上學員摘要。 */
/* 應用程式 shell、頁籤與全域 modal 容器。 */
/* 離線提示固定在 header 下方，不遮住主要操作。 */
/* 全站色彩與間距 tokens；元件 CSS 應優先重用這些變數。 */
```

不得修改 CSS custom property、selector、declaration 或 media query。

- [ ] **Step 4: 重跑測試、檢查並提交**

Run:

```powershell
npm --prefix dashboard test -- src/components/overview/OverviewTab.test.jsx
git diff --check -- dashboard/src/components/overview dashboard/src/App.css dashboard/src/index.css
git diff --word-diff=porcelain -- dashboard/src/components/overview dashboard/src/App.css dashboard/src/index.css
git commit --only -m "docs: clarify dashboard presentation modules" -- dashboard/src/components/overview/OverviewTab.jsx dashboard/src/components/overview/AgeDistributionChart.jsx dashboard/src/components/overview/CoursePopularityChart.jsx dashboard/src/components/overview/EducationDistributionChart.jsx dashboard/src/components/overview/KpiCards.jsx dashboard/src/components/overview/SeniorsMetricCard.jsx dashboard/src/components/overview/OverviewTab.test.jsx dashboard/src/components/overview/OverviewTab.css dashboard/src/App.css dashboard/src/index.css
```

Expected: 測試通過；commit 只有 JSX/CSS comments。

### Task 7: 前端畫面流程整體驗證

**Files:**
- Verify: `dashboard/src/components/**/*`
- Verify: `dashboard/src/App.css`
- Verify: `dashboard/src/index.css`

**Interfaces:**
- Consumes: Tasks 1–6 的 comment-only changes
- Produces: 可交付的前端元件註解批次與保留中的重疊 unstaged comments

- [ ] **Step 1: 執行完整前端品質檢查**

Run:

```powershell
git diff --check
npm --prefix dashboard run lint
npm --prefix dashboard test
npm --prefix dashboard run build
```

Expected: `git diff --check` 無輸出；lint exit code 為 0；完整測試與 build 成功；不得新增 lint 或 build 警告。

- [ ] **Step 2: 人工確認 JSX/CSS 非註解內容未變**

Run:

```powershell
git diff --word-diff=porcelain -- dashboard/src/components dashboard/src/App.css dashboard/src/index.css
git status --short
```

Expected: component/CSS 修改只涉及 comments；`AdminAccountPage.jsx` 與測試仍同時保有原 staged 功能變更及 unstaged 註解。

- [ ] **Step 3: 列出未提交的重疊註解供使用者接續處理**

Run:

```powershell
git diff -- dashboard/src/components/admin/AdminAccountPage.jsx dashboard/src/components/admin/AdminAccountPage.test.jsx
```

Expected: 輸出只含本計畫新增的管理員畫面註解；不得為了清空工作樹而覆寫、restore 或提交使用者既有內容。
