# 資料庫權威角色與最高管理員治理設計

日期：2026-08-24  
狀態：已完成對話設計核准，待書面規格審閱

## 背景

目前系統將 `viewer`、`editor`、`admin` 儲存在 Supabase Auth 的 `app_metadata`，RLS 透過 JWT 內的角色宣告授權。任何一般管理員也能在保留至少一位管理員的前提下升降或刪除其他管理員。這使一般管理員具備同級帳號治理能力，而且角色變更必須等待 JWT 更新後，資料庫權限才會完全反映。

本設計將角色改由資料庫資料表統一管理，新增唯一的 `owner` 最高管理員，並限制一般管理員只能管理 `editor` 與 `viewer`。先在 `C:\Users\user\Desktop\work2` 實作及驗證，再把同等功能精準同步到 `C:\Users\user\Desktop\work`，最後重新建置後者的 `dashboard/dist`。

## 目標

1. 以資料庫角色表作為所有授權決策的唯一權威來源。
2. 將 `admin@admin.com` 設為唯一 `owner`。
3. 將 `stern4310910040@gmail.com` 保持為一般 `admin`。
4. 一般 `admin` 不得管理其他 `admin` 或 `owner`。
5. 角色被降級或帳號被刪除後，RLS 與 Edge Function 立即使用最新狀態。
6. 保留既有稽核、邀請、重設密碼及使用者管理流程。
7. 保留兩個工作目錄中所有與本功能無關的未提交修改。

## 非目標

- 不新增多位 `owner` 或讓介面指派 `owner`。
- 不重新設計 `viewer`、`editor` 的既有資料操作權限。
- 不把所有資料修改改寫成 Edge Function。
- 不在本功能實作階段自動部署任一遠端 Supabase 專案。
- 不直接編輯 `dashboard/dist` 內的產物；產物一律由正式建置生成。

## 角色模型

### 角色

| 角色 | 一般資料權限 | 帳號治理權限 |
| --- | --- | --- |
| `viewer` | 維持目前唯讀能力 | 無 |
| `editor` | 維持目前新增與編輯能力，不可刪除 | 無 |
| `admin` | 維持目前完整資料管理能力 | 可管理 `viewer`、`editor`，不可管理 `admin`、`owner` |
| `owner` | 與 `admin` 相同 | 可管理一般 `admin`、`editor`、`viewer`；不可修改或刪除自己 |

### 固定帳號

- `admin@admin.com`：唯一 `owner`。
- `stern4310910040@gmail.com`：一般 `admin`。
- `owner` 不出現在邀請或角色選單中，也不接受 Edge Function 的一般角色變更請求。
- 直接透過受控資料庫遷移或 Supabase 管理程序仍可執行緊急復原；一般應用程式介面不能改動唯一 `owner`。

### 帳號操作矩陣

| 操作者 | 目標 | 可執行操作 |
| --- | --- | --- |
| `admin` | `viewer`、`editor` | 改為 `viewer` 或 `editor`、刪除、重寄邀請、寄送密碼重設信 |
| `admin` | `admin`、`owner` | 僅檢視；所有帳號異動停用且由後端拒絕 |
| `owner` | `viewer`、`editor` | 可改為 `viewer`、`editor` 或 `admin`，並可執行其他既有管理操作 |
| `owner` | 一般 `admin` | 可降級、刪除或寄送密碼重設信 |
| 任一角色 | 自己 | 不可透過帳號管理頁修改角色或刪除自己 |
| 任一角色 | `owner` | 不可透過帳號管理 API 修改或刪除 |

邀請流程仍一律建立 `viewer`。只有 `owner` 能在受邀者完成首次登入後將其升為 `admin`。

## 資料庫設計

### `public.app_user_roles`

建立專用角色表，至少包含：

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `role text not null`，以檢查約束限制為 `viewer`、`editor`、`admin`、`owner`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`user_id` 主鍵同時提供角色查詢所需索引。另建立 `role = 'owner'` 的部分唯一索引，確保最多只有一筆 `owner`。

### 權限與 RLS

- 啟用 RLS。
- `anon` 無任何表權限。
- `authenticated` 只取得 `SELECT`，且只能讀取 `user_id = auth.uid()` 的本人資料。
- `authenticated` 不取得 `INSERT`、`UPDATE`、`DELETE`。
- Edge Function 使用的後端 service role 可讀寫角色表；service role 金鑰不得進入前端。
- 找不到本人角色資料時，授權函式回傳空值，所有既有角色條件都失敗，不降級成 `viewer`。

### Auth 同步觸發器

在非 exposed schema 中建立單一用途的 Auth 使用者新增觸發函式，並設定空 `search_path`、完整 schema qualification 與最小執行權限。

- 新增 `auth.users` 資料時，同一資料庫交易內新增角色列。
- Email 為 `admin@admin.com` 時建立 `owner`；其他新帳號建立 `viewer`。
- 觸發器失敗時 Auth 使用者建立也失敗，避免產生可登入但沒有角色的孤兒帳號。
- 刪除 Auth 使用者時由外鍵 cascade 移除角色列。

### 既有帳號回填

新 migration 建表後回填所有既有 `auth.users`：

1. `admin@admin.com` 強制為 `owner`。
2. `stern4310910040@gmail.com` 強制為 `admin`。
3. 其他帳號保留既有 `app_metadata.app_role` 中合法的 `viewer`、`editor`、`admin`。
4. 缺少或不合法的舊角色回填為 `viewer`。
5. 其他帳號即使意外帶有舊的 `owner` 字串，也不得回填為 `owner`。

舊 `app_metadata` 可留作歷史相容資料，但新程式不得再以它做授權或角色顯示。角色異動後不要求它保持同步。若必須回滾至舊版，應先以受控程序把角色表同步回 `app_metadata`，再切回舊程式。

### `current_app_role()`

以新的 imperative migration 重新定義 `public.current_app_role()`；不修改歷史 migration。

- 函式以呼叫者的 `auth.uid()` 查詢 `app_user_roles`。
- 使用 `security invoker` 與固定 `search_path`。
- `owner` 對一般資料操作回傳等效的 `admin`；帳號治理仍直接讀取原始 `owner`。
- 缺少角色列時回傳空值。
- RLS policy 以 `(select public.current_app_role())` 形式呼叫，避免逐列重複查詢。
- migration 只重建目前實際使用且參照此 helper 的 active policies。對兩個專案不完全相同的資料表採明確存在性保護，使同一安全意圖可套用而不引用不存在的資料表。
- RPC 內既有的單次角色檢查可繼續呼叫此 helper，因此不需要重寫每個 RPC 的業務流程。

## Edge Function 設計

`admin-users` 不再從 Auth `app_metadata` 判斷角色。

### 身分與角色解析

1. 由 bearer token 向 Supabase Auth 驗證使用者身分。
2. 以該使用者 ID 查詢 `app_user_roles`。
3. 缺少角色列時回傳 `ROLE_NOT_ASSIGNED`。
4. 僅 `admin` 與 `owner` 可進入帳號管理流程。
5. 讀取目標 Auth 使用者後，再以使用者 ID 取得目標的資料庫角色。

### 清單與異動

- `list_users` 將 Auth 使用者資料與角色表結果依 `user_id` 合併，不再摘要 `app_metadata.app_role`。
- `invite_user` 繼續建立預設 `viewer`；角色列由 Auth trigger 建立。
- `update_role` 只接受 `viewer`、`editor`、`admin` 作為輸入；`owner` 永遠不是可指派值。
- `update_role` 更新角色表，不更新 Auth metadata。
- `delete_user` 先以最新角色執行治理檢查，再刪除 Auth 使用者；角色列由 cascade 移除。
- `resend_invite` 與 `send_password_reset` 也執行相同的目標角色限制，避免一般管理員干預同級管理員。

### 稽核與錯誤

保留目前的 pending → success/failure 稽核流程，並新增或調整下列錯誤碼：

- `ROLE_NOT_ASSIGNED`：操作者或必要的目標角色不存在。
- `OWNER_PROTECTED`：嘗試修改或刪除唯一 `owner`。
- `ADMIN_TARGET_FORBIDDEN`：一般 `admin` 嘗試操作 `admin` 或 `owner`。
- `OWNER_REQUIRED`：嘗試指派、降級或刪除一般 `admin`，但操作者不是 `owner`。
- `ROLE_STORE_ERROR`：角色表查詢或異動失敗。

異動前先建立 pending audit；異動失敗則寫入 failure。若角色異動成功但 audit 完成更新失敗，角色表仍是正確權威狀態，介面顯示錯誤並重新整理清單，pending audit 供後續追查。

## 前端設計

### AuthContext

- Auth session 只負責確認身分。
- Session 建立後，AuthContext 查詢 `app_user_roles` 的本人資料。
- 狀態明確區分 `loading`、`ready`、`unassigned`、`error`。
- `unassigned` 或 `error` 顯示阻擋頁，提供重試與登出，不使用 `app_metadata` 或 `user_metadata` fallback。
- 角色在登入、token refresh 及明確重試時重新讀取。其他管理員異動目前使用者角色後，伺服器授權立即生效；畫面最晚在重新整理或下一次角色重讀後更新。

### 權限與導覽

- `owner` 取得與 `admin` 相同的資料操作、課程管理、FAQ、使用者手冊及帳號管理入口。
- 導覽與頁面保護改用 permission capability，避免散落 `role === 'admin'` 判斷。
- AppHeader 顯示 `owner` 為「最高管理員」，並提供相符的 badge 樣式。

### 帳號管理頁

- `owner` 與 `admin` 都可進入。
- `owner` 列的角色選單及刪除按鈕永久停用。
- 一般 `admin` 檢視 `admin`、`owner` 時，角色、刪除、重寄邀請及密碼重設等異動控制全部停用。
- `owner` 可管理一般 `admin`，但不能對自己執行管理操作。
- 角色選單不顯示 `owner` 選項。
- 後端仍完整驗證所有限制；前端停用只是可用性提示，不是安全邊界。
- 使用者手冊補充四種角色、唯一最高管理員及帳號治理限制。

## 測試策略

### Database

新增或擴充 SQL 測試，驗證：

- 角色表結構、檢查約束、外鍵、唯一 `owner` 索引與 grants。
- 既有使用者回填規則及兩個指定 Email 的結果。
- 新 Auth 使用者的 `viewer` 預設值與固定 owner 規則。
- 使用者只能讀取自己的角色且不能直接寫入。
- 同一份仍帶舊 JWT 角色的 session，在角色表被降級後立即受到新 RLS 限制。
- 缺少角色列與已刪除使用者的舊 token 均不能存取資料。
- `owner` 在一般資料 RLS 與 RPC 中具有 `admin` 等效能力。
- policies 使用 init-plan 形式呼叫角色 helper。

### Edge Function

以 domain 與 handler 測試涵蓋：

- 四種合法角色、無角色及非法角色。
- `owner`、`admin` 的 actor 驗證。
- 完整帳號操作矩陣。
- 唯一 owner、自我異動、一般 admin 目標保護。
- 使用資料庫角色而非 Auth metadata。
- 邀請、角色變更、刪除、重寄、重設密碼與稽核成功/失敗流程。

### Frontend

驗證：

- AuthContext 的非同步角色載入、重試、無角色與錯誤狀態。
- `owner` 權限與 `admin` 資料權限等效。
- 導覽與受保護頁面對四種角色的顯示。
- 帳號管理頁對 owner、同級 admin、自身與一般使用者的控制狀態。
- 使用者手冊的角色說明。

### 完整驗證

- Dashboard 單元與元件測試。
- Edge Function Deno 測試。
- Supabase database tests／本機 SQL 驗證。
- lint。
- production build。
- 在 `work2` 全部通過後，才同步並在 `work` 重跑對應測試與 build。

## 同步與部署

### 工作目錄同步

1. 在 `work2` 以測試驅動方式完成 migration、Edge Function、前端與文件修改。
2. 記錄本功能實際修改的檔案，逐檔套用到 `work`；不整批覆蓋資料夾。
3. 同步前後都檢查兩個 repo 的 dirty state，保留所有無關變更。
4. migration 對兩個專案的 schema 差異使用明確存在性保護或等效的專案專屬政策段落，不假設兩邊 migration history 完全相同。
5. 在 `work` 重跑測試、lint 與 production build，讓 Vite 重新產生 `dashboard/dist`。

### 遠端 Supabase

本功能的程式碼同步不代表自動套用遠端 migration。遠端部署需另行確認，並採下列順序：

1. 暫停帳號角色異動。
2. 備份或確認可復原狀態。
3. 套用角色表 migration 並執行 database tests／安全檢查。
4. 驗證資料庫中恰有一位 owner，且 Email 為 `admin@admin.com`；驗證 `stern4310910040@gmail.com` 為 `admin`。
5. 部署新版 `admin-users` Edge Function。
6. 部署新版前端。
7. 以 owner、admin、editor、viewer 各做一次 smoke test 後恢復帳號管理操作。

若需要回滾至仍依賴 Auth metadata 的舊版，先由角色表產生受控的 metadata 同步，再回滾 Edge Function 與前端；不得直接刪除角色表或讓已降權帳號恢復舊權限。

## 完成條件

- `admin@admin.com` 是資料庫中唯一 `owner`。
- `stern4310910040@gmail.com` 是一般 `admin`。
- 一般 `admin` 無法透過前端或 Edge Function 操作任何 `admin` 或 `owner`。
- `owner` 可管理一般 `admin`，但不能修改或刪除自己。
- RLS、RPC、Edge Function 與前端不使用 JWT metadata 作為角色授權來源。
- 缺少角色列時 fail closed。
- `work2` 與 `work` 都通過相應測試與 production build，且 `work/dashboard/dist` 由最新原始碼重建。
- 遠端 migration 只有在另行確認後才部署。
