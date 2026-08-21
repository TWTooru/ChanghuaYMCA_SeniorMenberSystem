# 相容式完整前端升級設計

**日期：** 2026-08-21  
**來源系統：** `C:\Users\user\Desktop\work2`  
**目標系統：** `C:\Users\user\Desktop\work`  
**狀態：** 已確認設計方向，待書面審閱

## 目標

在完全不修改 Supabase schema、migration、RPC 或遠端資料的前提下，將 `work2` 中可與 `work` 現有資料模型相容的前端改進整合到 `work`。升級後保留 `work` 的季別資料模型、季別分析、學員合併、邀請流程、會員欄位與既有帳務操作，同時改善搜尋、清單操作、帳務摘要、錯誤隔離、無障礙操作及介面一致性。

## 不可變更邊界

- 不修改 `supabase/` 下的任何檔案。
- 不執行 `supabase link`、`db push`、`db reset`、migration、遠端 SQL 或 Edge Function 部署。
- 不建立、刪除、重新命名或改寫資料表、欄位、constraint、index、policy、trigger 或 RPC。
- 不把 `work2` 的 `period`、`enrollment_forms`、首次報名 RPC 或精簡會員 schema 引入 `work`。
- 不變更 `work` 目前使用的 `season`、`mobile_phone`、年齡、學員合併與既有收據資料介面。
- 不複製 Supabase 專案 ref、金鑰、`.env.local` 或任何秘密。

## 已排除的 `work2` 功能

以下功能依賴新資料庫結構，因此本次不啟用：

- `season` 改為 `period` 的資料模型重構。
- 精簡會員欄位與會員 Excel／CSV 匯入格式。
- 新增會員與首筆報名的交易式精靈。
- `enrollment_forms` 多報名表資料層與相關建立、編輯、退費、刪除 RPC。
- 依新資料表計算的部分退費、表單批次與表單級帳務功能。
- 任何會要求 migration 或遠端 schema 變更的前端入口。

這些功能若只複製畫面，會呼叫目前資料庫不存在的欄位或 RPC，因此排除是資料安全與可用性的必要條件。

## 架構策略

採用「行為單元移植」而非整檔覆蓋。每項改進以 `work` 現有元件、domain helper、service 與測試為基底，從 `work2` 擷取可獨立運作的行為，再依 `work` 的欄位名稱與資料形狀調整。

資料流維持不變：

1. `useApiData` 仍讀取目前的 `students`、`enrollments`、`courses` 與收據關聯。
2. domain helper 只對已載入的前端快照做純計算。
3. UI 新增的搜尋、排序、KPI 與錯誤提示不產生新的資料庫寫入。
4. 既有 mutation 繼續呼叫 `work` 已存在的 service 與 RPC，不替換參數或端點。

## 功能設計

### 1. 全域快速搜尋

- 新增 `QuickSearch` 命令面板，支援 `Ctrl+K` 與 `Command+K` 開啟。
- 依 `student_id`、姓名與 `mobile_phone` 搜尋，最多顯示有限筆數以保持回應速度。
- 選擇結果後沿用 `openStudentDetail`，不建立新的資料讀取流程。
- 支援鍵盤導覽、Escape 關閉與正確的 dialog 語意。
- 在登入後且資料已載入時啟用；登入與設定密碼畫面不掛載全域快捷鍵。

### 2. 全域錯誤邊界

- 新增 `ErrorBoundary` 包住已認證 dashboard。
- 捕捉 React render 與 lifecycle 錯誤，顯示中文復原畫面與重新載入操作。
- 不吞掉網路或 Supabase 服務錯誤；既有離線 banner 繼續負責可預期的資料來源錯誤。
- 測試正常渲染、錯誤 fallback 與復原按鈕。

### 3. 學員清單效率

- 搜尋輸入加入短延遲 debounce，避免每次按鍵都重算大型清單。
- 每頁筆數提供固定選項，切換後回到第一頁。
- 排序從單一 ID 升級為可排序欄位與升／降冪，但沿用穩定比較及數字型 ID 排序。
- 保留現有性別、年齡、教育篩選與管理員學員合併按鈕。
- 清單、篩選或每頁筆數改變時，頁碼不得停在不存在的頁面。

### 4. 報名歷程搜尋與用語

- 搜尋範圍擴充為姓名、課程與收據號碼。
- 收據號碼從現有 `billingReceipts` 或 legacy `invoice_number` 摘要取得，不查詢新欄位。
- 介面文字統一為「收費狀況」與「收據 No.」，但資料欄位仍保留 `refunded`、`amount`、`invoice_number`。
- 保留 `season` 篩選與排序，不改成 `period`。
- 保留正常／已退費兩種既有狀態，不引入依賴表單層的部分退費。

### 5. 帳務摘要與營收 KPI

- 修正 `normalizeEnrollmentBilling`，完整處理關聯結果為陣列或物件，以及一門課存在多個收據連結的情況。
- 依 `receipt_id` 去重，避免同張分組收據因關聯多門課而重複計算。
- `summarizeEnrollmentBilling` 繼續以收據為主要來源，以 enrollment 的 legacy 金額與收據號碼作備援。
- `useStats` 新增 `totalRevenue` 與各季 `revenue`：只加總未退費報名的摘要金額。
- KPI 新增總營收卡與當季營收；無帳務資料時顯示 0，不把未知金額當成錯誤。
- 保留 `work` 的季別摘要、季別趨勢、年齡、熱門課程及樂齡統計。

### 6. Modal 無障礙與防誤觸

- 沿用並補齊 `useModalA11y` 的 Escape 關閉、Tab 焦點循環、初始焦點與關閉後焦點還原測試。
- 逐一檢查本次涉及的 modal 是否具有 `role="dialog"`、`aria-modal` 與可識別標題。
- 破壞性確認與有未儲存內容的 modal 不因點擊背景而關閉。
- operation 進行中維持既有按鈕停用與重複送出防護。
- 不藉由無障礙調整改變任何資料寫入行為。

### 7. 錯誤訊息與介面一致性

- 學員刪除遇到外鍵限制時顯示清楚中文訊息，不暴露原始 Postgres 細節。
- 保留未知錯誤原貌供既有上層處理，不把所有錯誤誤判為外鍵問題。
- 合併 `work2` 中與現有 DOM 結構相容的亮色／暗色對比、表格 footer、管理卡片與 FAQ 樣式修正。
- 保留 `work` 已完成的品牌名稱、邀請 callback 與角色下拉選單優化。
- 只調整 `index.html` 中不依賴 Supabase 設定的可存取性或 SEO metadata；跳過 `supabase/config.toml` 差異。

## 錯誤處理

- 搜尋與統計 helper 對缺少欄位、`null`、空陣列及舊資料形狀採安全預設值。
- UI 錯誤不得觸發自動重送 mutation。
- Error Boundary 僅處理未預期的 React 錯誤；可預期的 service 錯誤仍顯示在原操作位置。
- 快速搜尋與 modal 事件監聽器在卸載時完整移除，避免重複快捷鍵與記憶體洩漏。
- 若來源改進依賴 `period`、`forms` 或新 RPC，直接判定不相容，不建立假資料轉接層。

## 測試策略

所有行為變更使用 TDD：先在 `work` 寫出會因缺少行為而失敗的測試，確認失敗原因，再做最小實作。

### 聚焦測試

- `QuickSearch`：快捷鍵、搜尋欄位、選擇結果、Escape、空結果與卸載清理。
- `ErrorBoundary`：正常 children、錯誤 fallback 與重新載入操作。
- `StudentListTab`／`StudentTable`：debounce、頁數、每頁筆數、各欄排序及學員合併入口保留。
- `EnrollmentTab`：現行與 legacy 收據號碼搜尋、季別與退費篩選共存、用語與欄位標題。
- `enrollmentBilling`：單／多連結、共享收據去重、legacy fallback 與缺失關聯。
- `useStats`／`KpiCards`：未退費營收、退費排除、共享收據不重複、當季與總營收。
- `useModalA11y` 與相關元件：Escape、Tab／Shift+Tab、焦點還原與背景點擊。
- `studentService`：只將 `23503` 映射為友善刪除訊息，其他錯誤保持原樣。

### 完成驗證

- 基準：`work` 目前 57 個測試檔、409 個測試全數通過。
- 執行全部 Vitest 測試，新增與既有測試皆須通過。
- 執行 `npm run lint`。
- 執行 `npm run build`。
- 執行唯讀 Git 狀態與差異檢查，確認沒有 `supabase/`、環境檔或秘密被修改。
- 不執行 Supabase database tests，因本次刻意不修改或啟動資料庫環境。

## 驗收標準

- `work` 可正常登入並保留現有頁籤、季別分析、學員合併與邀請流程。
- `Ctrl+K` 可快速找到並開啟學員資料。
- 學員清單能 debounce 搜尋、改變每頁筆數及使用多欄排序。
- 報名歷程可用收據號碼搜尋，既有季別與退費篩選仍可用。
- 帳務摘要不漏掉多重收據關聯，營收 KPI 不重複計算共享收據。
- Modal 鍵盤操作與焦點還原可由測試驗證，重要對話框不會因背景誤觸關閉。
- 外鍵限制刪除錯誤以中文顯示。
- React 未預期錯誤不再造成無提示白畫面。
- 全部前端測試、lint 與 production build 通過。
- `supabase/` 與遠端資料庫完全未變更。

## 後續另案

若未來允許升級資料庫，需另立設計處理 schema 快照、備份、舊欄位保存、`season` 至 `period` 轉換、`enrollment_forms` 回填、student merge 相容、migration rehearsal 與還原演練。本規格不預先加入或部署這些變更。
