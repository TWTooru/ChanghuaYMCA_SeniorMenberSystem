# 新增會員與首筆報名精靈設計

日期：2026-08-17

## 背景

目前「新增會員」視窗只建立 `students` 會員基本資料；期別、課程與收費則必須在會員建立後，另外開啟新增報名流程。紙本報名表另有期間、備註、預繳、分類費用、收據號碼及經手資訊，因此新增會員時需要一併建立首筆報名，而且不能在部分失敗時留下沒有報名的孤立會員。

## 目標

- 以兩步驟精靈完成會員基本資料與首筆報名資料輸入。
- 最後一次送出，於同一個 Postgres 交易內建立會員、報名與課程關聯。
- 保存紙本報名表上的期別期間、兩組收據資訊、費用分類、備註與經手資訊。
- 由可信任的登入狀態記錄實際操作帳號，前端不得偽造。
- 延續目前角色權限、會員欄位規則、課程目錄與錯誤訊息風格。

## 非目標

- 不合併或取代既有會員的「新增報名」流程。
- 不改造現有依課程分組的 `billing_receipts` 帳務模型；本次紙本表單費用是該筆報名的欄位。
- 不在本次新增既有報名的編輯或報表匯出功能。
- 不要求回填歷史報名的新欄位。

## 使用者流程

### 步驟 1：會員資料

沿用目前欄位與規則：

- ID（選填；空白時由資料庫配置）
- 姓名（必填）
- 性別（必填）
- 電子郵件
- 電話
- 出生年月日
- 通訊處
- 服務機關／學校
- 教育程度（必填）

按「下一步」時先執行會員欄位的前端驗證，但不寫入資料庫。

### 步驟 2：首筆報名

欄位分組如下：

1. 報名資訊
   - 期別（必填，沿用 `第16期` 格式）
   - 開始日期（必填，原生日期選擇器）
   - 結束日期（必填，原生日期選擇器）
   - 報名課程（至少一門，重用既有課程選擇器）
2. 預繳
   - 預繳金額（選填）
   - 預繳 No.（選填，與正式收據號碼分開保存）
3. 正式收費
   - 學費（選填）
   - 教材費（選填）
   - 會友費（選填）
   - 正式收據 No.（選填，由前三項費用共用）
4. 經手資訊
   - 備註（選填，多行文字）
   - 經手人姓名（選填，自由輸入）
   - 登入帳號（自動帶入目前登入電子郵件，唯讀）
   - 辦理日期（選填，原生日期選擇器）

使用者可按「上一步」修改基本資料，所有已輸入內容必須保留。只有第二步顯示「新增會員及報名」按鈕。

## 前端元件

`AddStudentModal` 保留為對外入口與共同狀態容器，內部分成：

- `MemberProfileStep`：呈現並驗證會員基本資料。
- `InitialEnrollmentStep`：呈現並驗證首筆報名資料。
- `CourseTagPicker`：沿用目前的課程選擇行為。

`AddStudentModal` 從 `AuthContext` 讀取目前 `user.email` 供唯讀顯示，但送往 RPC 的 payload 不包含可指定的登入者 ID 或帳號。送出期間以同步 ref 防止雙擊重複送出，並停用導覽、關閉及送出控制。成功後只觸發一次 `onRefresh`，再關閉視窗。

服務層新增語意清楚的 `createStudentWithInitialEnrollment(client, student, enrollment)`。元件不直接組合 Supabase RPC 參數，也不再依序呼叫 `createStudent` 與 `createEnrollmentWithCourses`。

## 資料模型

新欄位屬於每一期報名，因此加在 `public.enrollments`：

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `period_start_date` | `date` | 歷史資料可為空；新 RPC 要求提供 |
| `period_end_date` | `date` | 歷史資料可為空；不得早於開始日期 |
| `notes` | `text` | 空白正規化為 `null` |
| `prepaid_amount` | `integer` | 可空，不得小於 0 |
| `prepaid_receipt_number` | `text` | 空白正規化為 `null` |
| `tuition_fee` | `integer` | 可空，不得小於 0 |
| `materials_fee` | `integer` | 可空，不得小於 0 |
| `membership_fee` | `integer` | 可空，不得小於 0 |
| `fee_receipt_number` | `text` | 空白正規化為 `null` |
| `handled_by_name` | `text` | 空白正規化為 `null` |
| `handled_by_user_id` | `uuid` | 由 `auth.uid()` 寫入，不接受 client 值 |
| `handled_by_account` | `text` | 由登入 JWT 的電子郵件建立歷史快照 |
| `handled_on` | `date` | 可空 |

金額沿用目前系統以整數新台幣保存的慣例。新欄位保持 nullable，避免 migration 為既有報名捏造未知資料；新建流程所需的必填規則由 RPC 驗證。資料庫新增日期順序與各金額非負的 check constraints。

`handled_by_user_id` 不建立到 `auth.users` 的 foreign key，讓歷史經手紀錄在帳號刪除後仍可保留；`handled_by_account` 是當下帳號的不可變快照，而不是授權依據。

## 原子寫入與安全性

新增 RPC：

```text
create_student_with_initial_enrollment(
  p_student jsonb,
  p_enrollment jsonb
) -> jsonb
```

RPC 在單一資料庫交易中依序：

1. 驗證目前登入者是 `editor` 或 `admin`，並確認 `auth.uid()` 存在。
2. 驗證及正規化會員 payload，建立會員並取得 `student_id`。
3. 驗證期別、日期、課程、金額及選填文字。
4. 建立首筆報名，固定首筆報名類型為「新」。
5. 建立所選課程關聯。
6. 由 `auth.uid()` 與登入 JWT 電子郵件寫入經手帳號資訊。
7. 回傳新會員與報名 ID。

任何步驟拋出錯誤都會使整個 RPC 交易回復。函式使用固定空 `search_path` 和完整 schema qualification；若沿用現有 privileged RPC 模式而採 `security definer`，必須在函式內做角色及登入檢查，並撤銷 `public`、`anon` 的執行權，只授予 `authenticated`。前端傳入的 JSON 即使包含 `handled_by_user_id` 或 `handled_by_account` 也一律忽略。

本專案使用 imperative migrations；實作時以 Supabase CLI 建立正式 migration，並在提交前檢查 migration 清單與資料庫 advisors。

## 驗證與錯誤處理

前端在送出 RPC 前檢查：

- 會員現有必填與 ID 格式。
- 期別符合既有正規格式。
- 開始與結束日期皆有值，且結束日期不早於開始日期。
- 至少選擇一門課程。
- 金額為空或零以上的整數。

資料庫重做所有影響一致性與安全性的檢查。服務層將穩定錯誤代碼映射成中文訊息，例如日期順序錯誤、費用格式錯誤、權限不足、會員 ID／電子郵件重複及同一期報名重複。失敗時視窗保持開啟、停用狀態解除，兩步驟的輸入都保留；成功前不得呼叫 `onRefresh` 或 `onClose`。

## 測試策略

### React 元件測試

- 第一步顯示既有會員欄位，第二步顯示所有新報名欄位。
- 下一步、上一步與返回後狀態保留。
- 日期欄位為 `type=date`；登入帳號取自 AuthContext 且唯讀。
- 必填期別、日期、至少一門課程；日期順序錯誤時不呼叫 service。
- 空白金額轉為 `null`；0 可接受；負數及非整數被拒絕。
- 成功 payload 完整且不含可偽造的登入者欄位。
- 雙擊只送出一次；錯誤時保留視窗及輸入；成功後只 refresh 與 close 一次。

### 服務測試

- 使用正確 RPC 名稱及參數。
- 正確回傳會員與報名 ID。
- 將資料庫穩定錯誤代碼映射成中文訊息。

### pgTAP 資料庫測試

- 新欄位型別及 constraints 正確。
- editor/admin 可建立，viewer/anon 不可建立。
- 成功時同時存在會員、報名與全部課程關聯。
- 登入 user ID／account 取自資料庫登入狀態，忽略 payload 偽造值。
- 日期錯誤、負數費用、重複 ID／email、無課程或無效期別會失敗。
- 在建立報名或課程階段失敗時，先前插入的會員也不存在，證明原子回復。
- 既有報名在新 nullable 欄位加入後仍可正常讀取。

### 完整驗證

執行 dashboard 定向測試後，再執行完整 `npm test`、`npm run lint`、`npm run build`，以及可用的 Supabase database tests 與 advisors。完成宣告必須以同一工作階段的新鮮輸出為準。

## 驗收條件

- 使用者可在新增會員視窗以兩步驟完成基本資料與首筆報名。
- 日期以點選方式輸入，登入帳號自動顯示且不可修改，經手人姓名可自由輸入。
- 兩組 No. 分開保存；學費、教材費、會友費共用正式收據 No.。
- 所有新增選填欄位均可留空；期別、開始日期、結束日期與至少一門課程不可留空。
- 成功時會員、報名與課程一次建立；失敗時不留下任何部分資料。
- 未授權角色不能透過直接呼叫 RPC 繞過介面建立資料。
