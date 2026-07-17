# Student ID Relations Design

## Goal

修正 dashboard 以學員姓名建立資料關聯的問題，確保同名學員的選課歷程與詳情操作永遠依 `student_id` 對應正確資料。

## Scope

- 維持現有 Supabase schema、foreign key、RLS 與 migrations 不變。
- 維持現有元件 props 與 Excel 匯入格式不變。
- `student_name` 保留作搜尋與畫面顯示，不再作為資料關聯鍵。
- 本階段只處理 dashboard 的學員與選課關聯及相關測試。

## Architecture

在 `dashboard/src/domain/` 新增集中式關聯 helper：

- `getStudentById(students, studentId)`：依 `student_id` 尋找學員；找不到時回傳 `null`。
- `getEnrollmentsForStudent(enrollments, studentId)`：依 `student_id` 篩選選課紀錄；輸入無效或找不到時回傳空陣列。

兩個 helper 都使用 `String(id)` 正規化非空 ID，避免 Supabase 或測試資料中的數字／字串差異造成錯誤匹配。姓名不作為備援條件。

## Component Changes

### StudentDetailModal

以 `student.student_id` 呼叫 `getEnrollmentsForStudent`，取代目前以 `student_name === student.name` 篩選歷程的做法。期別排序、編輯、刪除及新增選課流程維持不變。

### EnrollmentTab

點擊選課紀錄時，以 `enrollment.student_id` 呼叫 `getStudentById`，取代目前以姓名尋找學員的做法。若找不到學員，不開啟 Modal，也不以姓名猜測對應資料。

### dashboardDataService

維持現有 `student_name` 衍生欄位。此欄位只供列表顯示與文字搜尋，所有關聯仍以 `student_id` 為準。

## Data Flow

1. `dashboardDataService` 從 Supabase 取得 students 與 enrollments。
2. enrollment 保留原始 `student_id`，並附加顯示用 `student_name`。
3. 學員詳情以 `student_id` 篩選歷程。
4. 選課列表點擊以 `student_id` 反查學員。
5. 新增、編輯與刪除仍將 `student_id` 傳給現有服務或 Supabase 查詢。

## Error Handling

- 空陣列、`null` 或 `undefined` 輸入不得拋出例外。
- `getStudentById` 找不到 ID 時回傳 `null`。
- `getEnrollmentsForStudent` 找不到 ID 時回傳空陣列。
- enrollment 若沒有可對應的 student，列表可繼續顯示「未知」姓名，但點擊不開啟其他同名學員。
- 不以姓名作 fallback，避免資料錯配被靜默掩蓋。

## Testing

採測試先行，新增或擴充測試以覆蓋：

- 數字與字串型別的相同 ID 可以匹配。
- 同名學員只取得各自的選課紀錄。
- 選課列表依 `student_id` 開啟正確的同名學員。
- 不存在的 ID 回傳安全預設值，且不退回姓名匹配。
- 現有資料服務、元件與完整測試仍通過。

## Verification

- `npm test`
- `npm run lint`
- `npm run build`
- 確認沒有新增或修改 `supabase/migrations/` 內容。

## Success Criteria

- dashboard 中不存在以姓名建立學員／選課關聯的程式碼。
- 同名學員的詳情與選課歷程保持完全隔離。
- 孤兒選課紀錄不會開啟錯誤學員。
- 完整測試與 production build 通過；lint 無新增警告。
