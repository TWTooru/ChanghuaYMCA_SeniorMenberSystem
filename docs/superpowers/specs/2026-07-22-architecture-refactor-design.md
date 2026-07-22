# YMCA 學員資訊管理系統 — 架構重構設計

> **日期**: 2026-07-22
> **範圍**: 可維護性與程式碼品質改善（漸進式重構）
> **方針**: 不改變任何業務邏輯或 UI 行為，純結構性改善

---

## 1. 背景與動機

專案經過數次功能疊代後，數個核心檔案的職責過於集中，增加了閱讀、修改與測試的成本。本次重構聚焦在五個具體問題：

| # | 問題 | 嚴重程度 | 證據 |
|---|---|---|---|
| 1 | `App.jsx` 職責過載 | 高 | 303 行，10+ 個 state、stats 計算、export 邏輯、所有 modal 管理 |
| 2 | `App.css` 巨型單檔 | 高 | 1717 行，所有元件共享一份 CSS，無法追蹤使用狀態 |
| 3 | 元件直接操作 supabase client | 中 | `StudentDetailModal`、`AddStudentModal`、`StudentEditForm` 繞過 service 層 |
| 4 | 大型元件未充分拆分 | 中 | `OverviewTab` 16KB、`StudentListTab` 12KB、`StudentDetailModal` 12KB |
| 5 | CSS 風格不一致 | 低 | Login 用 Tailwind，其餘用 vanilla CSS |

### 不在範圍內

- 引入 state management library（專案規模不需要）
- 引入 React Router（tab 架構足夠）
- 修改資料庫 schema 或 Edge Functions
- 修改既有的業務邏輯或 UI 行為

---

## 2. App.jsx 職責分解

### 現狀

`App.jsx` 的 `AuthenticatedDashboard` 函式承擔 5 種職責：

1. **統計計算** (L43-95) — `useMemo` 計算 stats
2. **匯出邏輯** (L253-281) — `onExport` callback 內含資料過濾 + 課程重算
3. **Modal 狀態管理** (L28-33) — 6 個 boolean/object state
4. **學員選取與同步** (L98-114) — `openStudentDetail` + `useEffect` sync
5. **頁面佈局** (L120-284) — header + nav + main + footer + modal 渲染

### 拆分方案

```
App.jsx (303 行) → App.jsx (~80 行，只剩佈局和組合)
                 ├── hooks/useStats.js
                 ├── hooks/useExportHandler.js
                 ├── hooks/useStudentSelection.js
                 └── components/common/AppHeader.jsx
```

### 介面定義

**`useStats(students, enrollments)`**

- 回傳 `stats` 物件，包含 `totalStudents`, `totalRegistrations`, `totalRefunds`, `males`, `females`, `ageGroups`, `eduCounts`, `popularCourses`
- 純計算，無副作用
- 內部使用 `useMemo`，依賴 `[students, enrollments]`

**`useExportHandler(students, enrollments)`**

- 回傳 `handleExport({ exportScope, selectedSeason, options })` function
- 封裝：依 scope 過濾 enrollments/students → 重算 courseCounts → 呼叫 `exportToExcel`
- 依賴 `useCallback`，引用 `students` 和 `enrollments`

**`useStudentSelection(students)`**

- 管理 state: `selectedStudent`, `studentDetailInitialTab`, `studentDetailIsTabbed`
- 提供: `openStudentDetail(student, initialTab)`, `closeStudentDetail()`
- 內建 refresh 同步：當 `students` 更新時，自動以 `student_id` 比對更新 `selectedStudent`

**`AppHeader`**

- Props: `dbStatus`, `dbError`, `permissions`, `user`, `role`, `onRefresh`, `onShowExportModal`, `onSignOut`
- 負責 header 渲染，包含 DB 連線狀態、ExcelSync 按鈕、下載按鈕、使用者資訊

**保留在 `AuthenticatedDashboard` 中的**：

- Modal 的 boolean 開關（`showAddStudentModal`, `showAddEnrollModal`, `showExportModal`）——與佈局渲染直接相關
- `activeTab` state——驅動主要內容區域切換
- `refreshCount` + `handleRefresh`——驅動資料重載

---

## 3. Service 層統一

### 現狀

`services/` 目錄已有 `enrollmentService.js`、`dashboardDataService.js`、`dataImportService.js`、`adminUserService.js`、`importPreviewService.js`，但 student CRUD 操作散落在元件中。

### 新增 `services/studentService.js`

```js
export async function createStudent(client, studentData) { ... }
export async function updateStudent(client, studentId, payload) { ... }
export async function deleteStudent(client, studentId) { ... }
```

### 擴充 `services/enrollmentService.js`

```js
// 新增
export async function deleteEnrollment(client, enrollmentId) { ... }
```

### 元件改造

| 元件 | 改動 |
|---|---|
| `StudentDetailModal.jsx` | `handleDeleteStudent` → 呼叫 `studentService.deleteStudent` |
| `StudentDetailModal.jsx` | `handleDeleteEnrollment` → 呼叫 `enrollmentService.deleteEnrollment` |
| `AddStudentModal.jsx` | `handleAddStudentSubmit` → 呼叫 `studentService.createStudent` |
| `StudentEditForm.jsx` | `handleSave` → 呼叫 `studentService.updateStudent` |
| `AddEnrollModal.jsx` | 移除直接 `import { supabase }`，改為 service 呼叫 |

### Cascading Delete 簡化

`StudentDetailModal` 目前手動三步 cascading delete（courses → enrollments → students）。資料庫已有 `ON DELETE CASCADE`，`studentService.deleteStudent` 只需：

```js
export async function deleteStudent(client, studentId) {
  const { error } = await client.from('students').delete().eq('student_id', studentId)
  if (error) throw error
}
```

DB cascade 自動處理 enrollments 和 courses 的清除。

### Supabase Client 注入模式

維持現有模式：元件 `import { supabase }` 後傳入 service function。這保持 service 的可測試性（測試時傳入 mock client），不引入 DI 框架。

---

## 4. CSS 拆分與 Tailwind 統一

### 策略：先拆後轉

#### Phase 1：物理拆分 App.css

把 `App.css` (1717 行) 按元件群組拆成多個 CSS 檔，每個 CSS 檔在對應元件裡 import。不改任何 class 名稱，純搬移。

```
App.css (1717 行) → 拆成：
├── App.css                              (~100 行, 主佈局 + header + nav + footer)
├── components/overview/OverviewTab.css
├── components/students/students.css     (StudentList, Detail, Edit 共用)
├── components/enrollment/enrollment.css
├── components/sync/sync.css
├── components/admin/admin.css
├── components/common/common.css         (modal-overlay, form-grid 等共用類別)
```

#### Phase 2：逐元件遷移到 Tailwind

拆分完成後，日常開發中逐個元件遷移到 Tailwind inline class。遷移完一個元件就刪掉對應的 CSS 區塊。不設硬性期限。

### 共用樣式處理

- **佈局/容器類** (`.form-grid`, `.modal-overlay-center`) → 保留在 `common.css` 直到所有使用方都遷移完
- **按鈕/表單控制項** (`.btn-primary`, `.form-input`) → 逐步被 shadcn/ui 的 `<Button>`, `<Input>` 取代
- **CSS 變數** (`--bg-primary`, `--color-accent` 等) → 遷移到 `tailwind.config.js` 的 `theme.extend`

### 不做的事

- 不引入 CSS Modules（既然走 Tailwind，多一層方案只會讓過渡期更混亂）
- 不改 shadcn/ui 的 `components.json` 配置

---

## 5. 大型元件拆分

### 5.1 OverviewTab.jsx (16KB → 4 個檔案)

```
OverviewTab.jsx → OverviewTab.jsx       (~40 行, 佈局 grid 組合)
                  KpiCards.jsx           (統計卡片: 總學員、總報名、退費等)
                  AgeDistributionChart.jsx  (年齡層甜甜圈圖 + SVG slice 計算)
                  CoursePopularityChart.jsx  (熱門課程圖表 + hover 互動)
```

SVG 圓餅圖的 slice 計算（`accumulatedCount`, `circumference` 等）封裝在各自的 Chart 元件內。

### 5.2 StudentListTab.jsx (12KB → 3 個檔案)

```
StudentListTab.jsx → StudentListTab.jsx  (~60 行, 佈局 + state 管理)
                     StudentFilters.jsx   (搜尋框 + 下拉篩選器)
                     StudentTable.jsx     (表格 + 分頁控制)
```

搜尋/過濾/分頁 state 和 `useMemo` 保留在 `StudentListTab`，子元件透過 props 接收過濾後的資料和 callbacks。

### 5.3 StudentDetailModal.jsx (12KB → hook 抽取)

```
StudentDetailModal.jsx → StudentDetailModal.jsx  (~80 行, modal 框架 + tab 切換)
                         hooks/useUnsavedChangesGuard.js (狀態機: hasUnsavedChanges + pendingAction + confirm/cancel)
```

### 不拆的元件

- `EnrollmentTab.jsx` (8KB) — 結構類似 StudentListTab 但更小
- `AddStudentModal.jsx` (8KB) — 主要是表單欄位，拆分效益不大
- `ExportOptionsDialog.jsx` (7KB) — 單一職責，大小合理

---

## 6. 執行順序

每一步獨立可交付，完成後系統可運行且測試通過。

```
Phase 1: 基礎層（無 UI 變化）
  ① 建立 services/studentService.js
  ② 擴充 services/enrollmentService.js (新增 deleteEnrollment)

Phase 2: 元件接線（行為不變，只改來源）
  ③ 元件改用 service function，移除直接 supabase 操作
  ④ 簡化 cascading delete（依賴 DB ON DELETE CASCADE）

Phase 3: App.jsx 瘦身
  ⑤ 抽取 useStats, useExportHandler, useStudentSelection hooks
  ⑥ 抽取 AppHeader 元件

Phase 4: CSS 拆分
  ⑦ App.css 物理拆分成多個檔案（純搬移）

Phase 5: 元件拆分
  ⑧ OverviewTab → KpiCards + AgeDistributionChart + CoursePopularityChart
  ⑨ StudentListTab → StudentFilters + StudentTable
  ⑩ StudentDetailModal → 抽取 useUnsavedChangesGuard hook

Phase 6: Tailwind 遷移（漸進，無固定期限）
  ⑪ 逐個元件從 vanilla CSS 遷移到 Tailwind
  ⑫ 共用 CSS 變數遷入 tailwind.config.js
```

---

## 7. 測試策略

| Phase | 測試方式 |
|---|---|
| Phase 1-2 | 新 service function 寫單元測試（mock supabase client），參考 `enrollmentService.test.js` 模式 |
| Phase 3 | 新 hook 寫單元測試；`App.test.jsx` 現有測試應不需修改 |
| Phase 4 | `npm run build` 確認無遺漏 import |
| Phase 5 | 以現有整合測試覆蓋（如 `OverviewTab.test.jsx`），行為未變不需新增 |
| Phase 6 | 視覺驗證為主，無行為變化 |

---

## 8. 風險與緩解

| 風險 | 緩解措施 |
|---|---|
| CSS 拆分遺漏某些 class | 拆分後立即 `npm run build`，Vite 會報 import 錯誤 |
| Cascading delete 簡化後行為不一致 | 先在測試中驗證 DB cascade 行為，再移除前端手動 cascade |
| Tailwind 遷移期間兩種風格並存 | 可接受的過渡狀態，共用的 `.btn-primary` 等透過 `common.css` 橋接 |
