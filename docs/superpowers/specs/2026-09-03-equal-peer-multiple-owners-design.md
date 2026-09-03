# 多位平權最高管理員設計規格

日期：2026-09-03
狀態：設計已批准，待實作計畫

## 背景

現有帳號治理以 `public.app_user_roles` 作為角色權威來源，但資料庫仍以 `app_user_roles_single_owner_idx` 限制只能有一位 `owner`，既有前端文件與帳號管理介面也把 `owner` 視為不可變更的固定帳號。工作樹中的部分 Edge Function 修改已開始允許 owner 管理 owner，卻尚未提供資料庫層的最後一位 owner 保護，因此兩位 owner 交叉降級或刪除時可能同時通過應用層檢查，最後留下零位 owner。

本設計把治理模型改為多位、完全平權的最高管理員。任何 owner 都可管理其他 owner，但資料庫必須在單一交易與併發交易下原子保證：系統一旦建立第一位 owner，就永遠至少保留一位 owner。

## 目標

1. 允許 `public.app_user_roles` 同時存在多筆 `role = 'owner'`。
2. owner 可將其他帳號升為 owner，也可降級或刪除其他 owner。
3. 不存在永久、不可刪除或可依 Email 自動恢復權限的 bootstrap owner。
4. 應用層維持禁止變更自己角色與刪除自己帳號。
5. 由 PostgreSQL 原子保護最後一位 owner，涵蓋直接角色異動及刪除 `auth.users` 所造成的 cascade。
6. 前端、Edge Function、資料庫、測試與使用文件採用同一套權限語意。

## 非目標

- 不改變 `viewer`、`editor`、`admin` 對業務資料的 RLS 權限。
- 不改變 `public.current_app_role()` 將 owner 映射成 admin 業務能力的行為。
- 不處理 Auth session token 更新與角色重新驗證問題；該問題需獨立設計與實作。
- 不處理會員教育程度選填的一致性問題；該問題需獨立設計與實作。
- 不加入 owner 核准流程、多人共同簽核、軟刪除或復原站。

## 已選方案

採用「私有單列 owner 計數器 + 交易內 row trigger」。不採只在 Edge Function 查詢 owner 數量，因為 read-check-write 無法避免併發競態；也不採跨 Edge、Auth Admin 與 Database 的兩階段鎖定流程，因為 HTTP 呼叫無法共享同一個 PostgreSQL 交易。

所有 owner 數量異動都更新同一筆私有 guard row。PostgreSQL 會序列化對同一列的並行更新；等待中的 `UPDATE` 會在先前交易完成後，以最新列版本重新判斷 `WHERE` 條件。角色表異動、cascade 與 trigger 同屬一個交易，任一步驟失敗即全部回滾。

## 權限矩陣

| 操作者 | 目標 | 帳號管理能力 | 可指派角色 |
| --- | --- | --- | --- |
| `owner` | 其他 `owner`、`admin`、`editor`、`viewer` | 允許既有的角色變更、刪除、重寄邀請及重設密碼操作；各操作原有的帳號狀態驗證仍適用 | `owner`、`admin`、`editor`、`viewer` |
| `owner` | 自己 | 禁止角色變更與刪除；既有頁面維持鎖定 | 無 |
| `admin` | `editor`、`viewer` | 維持既有管理能力 | `editor`、`viewer` |
| `admin` | `owner`、`admin` | 禁止 | 無 |
| 其他角色 | 任意帳號 | 禁止進入帳號管理控制面 | 無 |

`OWNER_PROTECTED` 只表示一般 admin 不可操作 owner，不再表示 owner 帳號本身永久受保護。所有 Edge Function 請求仍必須從 `app_user_roles` 重新讀取操作者及目標角色，不得以 JWT `user_metadata` 或 `app_metadata` 作為帳號管理授權來源。

## 資料庫設計

### 多 owner 儲存

移除 partial unique index `public.app_user_roles_single_owner_idx`。`app_user_roles.role` 的既有 check constraint 保持不變，仍只接受 `viewer`、`editor`、`admin`、`owner`。

### `private.owner_invariant`

在非 exposed 的 `private` schema 建立一張只含一筆資料的表：

- `singleton boolean primary key default true check (singleton)`：保證只能存在 key 為 `true` 的 guard row。
- `owner_count integer not null check (owner_count >= 0)`：保存與 `app_user_roles` 中 owner 數量一致的計數。

Migration 以目前 `app_user_roles` 的 owner 數量初始化 guard row：

- 角色表為空時允許初始值為 `0`，代表尚未建立第一個帳號。
- 角色表非空但 owner 數量為 `0` 時，migration 必須以 `OWNER_BOOTSTRAP_REQUIRED` 中止，不可猜測或自動提升既有帳號。
- 其他情況以實際 owner 數量初始化。

`private.owner_invariant` 啟用 RLS 且不建立任何 policy，也不授權給 `public`、`anon`、`authenticated` 或 `service_role` 直接讀寫。應用層需要 owner 數量時，使用 service-role client 對既有 `public.app_user_roles` 做精確 count，不直接暴露 guard table。

### Owner 計數 trigger

建立 `private.maintain_owner_invariant()`，並由 `public.app_user_roles` 的 row-level `AFTER INSERT OR UPDATE OF role OR DELETE` trigger 呼叫。它依角色轉換計算以下動作：

- 新增 owner，或由非 owner 升為 owner：將 `owner_count` 原子加一。
- owner 降為非 owner，或刪除 owner：只執行 `owner_count > 1` 的原子減一。沒有符合列時拋出 SQLSTATE `P0001`、訊息 `LAST_OWNER_REQUIRED`。
- 在零 owner bootstrap 狀態新增非 owner：鎖定 guard row 後拒絕，避免第一筆角色資料成為非 owner。
- 非 owner 間角色切換、owner 保持 owner，以及刪除非 owner：不改變計數。

Trigger 使用 `AFTER`，確保取得最終角色值；任何 guard 更新或例外均與原本角色異動位於同一交易。`auth.users` 對 `app_user_roles` 的 `ON DELETE CASCADE` 會觸發相同的 DELETE trigger，因此 Auth Admin hard delete 也受保護。

函式由 `postgres` 擁有，使用 `SECURITY DEFINER SET search_path = ''`，所有資料庫物件都以 schema-qualified 名稱引用。函式位於 `private` schema，並撤銷 `public`、`anon`、`authenticated`、`service_role` 的執行權限。Trigger 是它唯一的應用執行入口。

### 一次性 bootstrap

新帳號建立 trigger 的預設角色規則改為：

1. 若 guard 顯示尚未建立任何 owner，第一個 Auth 帳號建立為 owner。
2. 一旦已有 owner，所有新帳號預設為 viewer，之後只能由既有 owner 明確升級。
3. 多個第一帳號若極短時間並行建立，可能都成為 owner；這符合多 owner 模型，且不會造成零 owner。
4. `admin@admin.com` 不再具有永久 Email 特權。該帳號被其他 owner 刪除後重新建立時，只要系統仍有 owner，就會是 viewer。

既有安裝在 migration 前已擁有的 owner 保持原角色。新的規則只控制未來 Auth 帳號建立，不重寫其他既有角色。

## Edge Function 設計

### Domain 規則

`APP_ROLES` 與 `ASSIGNABLE_ROLES` 均包含四種角色。`assertTargetMutationAllowed` 實作上述權限矩陣：

- owner 可管理任何其他有效角色帳號，包括 owner。
- owner 可指派四種角色。
- admin 只能管理 editor、viewer，也只能指派 editor、viewer。
- 所有操作者都不能變更自己的角色或刪除自己的帳號。
- 未知或缺少的 stored role 一律 fail closed。

新增 `LAST_OWNER_REQUIRED`，HTTP status 為 `409 Conflict`。

### Adapter 與錯誤映射

角色更新經 PostgREST 寫入 `app_user_roles`。Adapter 必須辨識 SQLSTATE `P0001` 且 message 為 `LAST_OWNER_REQUIRED` 的錯誤，轉成同名 `ApiError`；其他資料庫錯誤維持 `ROLE_STORE_ERROR`。

刪除使用者仍使用 `auth.admin.deleteUser()`，不直接刪除 Supabase Auth 內部資料。GoTrue 對 Auth schema trigger 失敗只回傳泛用的 database error，因此刪除 owner 採兩層判斷：

1. 呼叫 Auth Admin 前，以 `countOwners()` 預檢；若目標是 owner 且只剩一位，回傳 `LAST_OWNER_REQUIRED`。此預檢只改善正常路徑訊息，不視為安全邊界。
2. Auth Admin 刪除失敗後重新讀取目標角色與 owner 精確數量。只有目標仍是 owner 且 owner 數量為一時，才映射成 `LAST_OWNER_REQUIRED`；重新查詢失敗或條件不符時保留原本的 `SUPABASE_AUTH_ERROR`。

資料庫 trigger 是唯一權威安全邊界。Edge Function 的計數預檢或錯誤重查失敗，均不得繞過資料庫拒絕。

### Audit

既有 `pending -> success/failure` 稽核流程保持不變。角色變更、刪除及最後 owner 拒絕都要記錄 actor role、target old role、new role（適用時）與結果。`LAST_OWNER_REQUIRED` 必須成為 failure audit 的 `error_code`，不得留下無法解釋的 pending 紀錄。

## 前端設計

帳號管理頁的 row policy 必須完全對齊 Edge Function：

- owner 查看其他 owner 時，角色選單、刪除與其他既有帳號操作正常啟用。
- owner 的角色選單依序提供 `owner`、`admin`、`editor`、`viewer`。
- 自己的帳號仍鎖定並顯示「目前登入帳號」。
- admin 查看 owner 或 admin 時維持唯讀，admin 的角色選單只提供 editor、viewer。
- 不在前端以目前列表數量判斷能否移除最後 owner；列表可能過期，資料庫才是權威。

新增 `LAST_OWNER_REQUIRED` 的繁體中文訊息：

> 至少必須保留一位最高管理員；另一項操作可能已先完成，請重新整理後再試。

錯誤發生時保留帳號列表與既有重試／重新整理入口，不顯示角色更新成功訊息。

## 測試策略

### Database / pgTAP

測試必須覆蓋：

- single-owner partial unique index 已不存在。
- 可建立及保留兩位以上 owner。
- owner 升級與降級會同步 owner counter。
- 直接 UPDATE 不得移除最後一位 owner。
- 直接 DELETE `app_user_roles` 不得移除最後一位 owner。
- DELETE `auth.users` 所造成的 cascade 不得移除最後一位 owner。
- 非最後一位 owner 的降級與 cascade 刪除可成功。
- 空資料庫的第一個 Auth 帳號成為 owner；後續帳號預設 viewer。
- 固定 Email 在已有 owner 時重新建立只會得到 viewer。
- guard counter 與實際 owner 數量一致。
- guard table、trigger function、`search_path`、owner、grants 與 RLS／schema exposure 符合最小權限要求。

### 併發整合測試

使用兩個獨立 PostgreSQL 連線，各自持有一筆 owner，並同時嘗試把對方降級。測試必須證明：

- 恰好一個交易成功。
- 另一個交易收到 `LAST_OWNER_REQUIRED`。
- 交易結束後 `owner_count = 1`，且與 `app_user_roles` 實際 owner 數一致。

同樣需要涵蓋一個角色降級與一個 Auth cascade 刪除競爭的情境；若 Auth API 測試環境只能觀察泛用 500，則同時驗證 Edge Function 最終映射為 `LAST_OWNER_REQUIRED`。

### Edge Function / Deno

- owner 可管理其他 owner，並可指派四種角色。
- owner 仍不可修改或刪除自己。
- admin 不可管理 owner／admin，也不可指派 owner／admin。
- PostgREST 的 last-owner 例外映射為 409。
- owner 刪除的預檢及失敗後重查分支正確。
- last-owner 拒絕會完成 failure audit。
- 非 last-owner 的角色更新與刪除維持既有成功回應格式。

### Frontend / Vitest

- owner peer row 可操作且包含四種角色選項。
- owner self row 維持鎖定。
- admin 對 owner／admin 維持鎖定。
- `LAST_OWNER_REQUIRED` 顯示指定文案、保留表格並不顯示成功提示。
- 未知角色仍 fail closed。

### 完整驗證

實作完成後執行資料庫測試、併發整合測試、全部 Deno tests、全部 Vitest、lint、production build 與 Supabase database advisors。資料庫測試需要本機 Supabase stack；目前工作環境的 Docker Desktop 未啟動，因此執行階段必須先恢復該前置條件，不能以單元測試取代資料庫驗證。

## 文件與歷史

更新 `架構.md` 與 `dashboard/src/components/manual/UserManualTab.jsx`，移除固定單一 owner 與 owner 不可操作的敘述，改為平權多 owner、禁止 self mutation、資料庫保證至少一位 owner。

`docs/superpowers/specs/2026-08-24-authoritative-account-roles-design.md` 與對應舊計畫保留為歷史紀錄，不回寫；本規格取代其中「固定單一 owner」相關決策。

現有未提交的 `supabase/migrations/20260825150000_allow_multiple_owners.sql` 將作為此功能的 migration artifact，由實作階段把目前僅刪除 index 的內容擴充為完整 invariant migration。部署到共享環境前必須確認該 migration 尚未被套用；若已套用，停止部署並以 Supabase CLI 產生後續修正 migration，不得改寫共享環境既有 migration 歷史。

## 驗收條件

1. owner 可在 UI 與 Edge API 將其他使用者升為 owner。
2. owner 可降級或刪除其他 owner，但不可修改或刪除自己。
3. 一般 admin 無法管理 owner 或 admin。
4. 任意順序及併發的合法應用操作都無法令 owner 數量降至零。
5. 最後 owner 被保護時，API 回傳 `LAST_OWNER_REQUIRED`／409，UI 顯示明確繁體中文訊息，audit 記為 failure。
6. 第一位帳號完成一次性 bootstrap；固定 Email 不具永久特殊權限。
7. 業務資料 RLS 對 owner 的既有 admin 等級能力不變。
8. 所有指定測試、lint、build 與 database advisors 通過後，功能才可提交為完成。

## 參考資料

- Supabase Database Functions：<https://supabase.com/docs/guides/database/functions>
- Supabase Changelog：<https://supabase.com/changelog>
- PostgreSQL Transaction Isolation：<https://www.postgresql.org/docs/current/transaction-iso.html>
- PostgreSQL Trigger Behavior：<https://www.postgresql.org/docs/current/trigger-definition.html>
- PostgreSQL Constraints：<https://www.postgresql.org/docs/current/ddl-constraints.html>
