# Supabase 後端與 Migrations 維護性註解 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 `admin-users` Edge Function、共用 CORS 與全部 Supabase migration 加入繁體中文維護性註解，清楚記錄安全邊界、交易／競態、相容性與歷史 schema 依賴。

**Architecture:** Edge Function 依 `domain → handler → runtime adapter` 分層註解，stable error code 與 audit 流程保持不變。Migration 每份至少加入目的摘要，重要 function、RLS、trigger、transaction、advisory lock 與 production repair 在原 SQL 鄰近位置解釋原因，不修改任何 SQL statement。

**Tech Stack:** Deno、TypeScript、Supabase JS、PostgreSQL SQL/PLpgSQL、Supabase Auth/RLS

## Global Constraints

- 註解使用繁體中文；程式識別字、資料表、欄位、function、policy 與錯誤碼保留原始英文並以反引號標示。
- Edge Function 只新增或改善 `//`、`/** */`；不改動型別、函式簽章、環境變數、request 順序、response body 或測試 assertion。
- SQL 只新增 `--` 或 `/* */` 註解；不改動 statement 文字、順序、transaction 邊界、grant、policy 或 function body。
- 不聲稱 migration 可安全回滾；歷史 migration 已套用後不得刪除。
- 保留工作樹現有 `domain.ts`、`index.ts`、`index_test.ts` staged 變更；這三檔新增註解只留在 unstaged working tree，不提交。
- 保留未追蹤的 `20260728130000_standardize_zumba_course_catalog.sql` 原始內容；可加入註解，但不得 stage 或 commit 整份使用者檔案。
- SQL 不套用 linked database；驗證以 comments-only diff 與既有程式測試為準。

## File Structure

| 層級 | 檔案 | 責任 |
|---|---|---|
| CORS | `supabase/functions/_shared/cors.ts` | 建立固定 dashboard origin 的 response headers |
| Domain | `supabase/functions/admin-users/domain.ts` | action 白名單、role/email 正規化、stable errors、安全輸出 |
| Handler | `supabase/functions/admin-users/handler.ts` | request 驗證、fresh actor、mutation 與 audit 狀態機 |
| Runtime adapter | `supabase/functions/admin-users/index.ts` | env、service-role client、Supabase error mapping、CORS |
| Edge tests | `domain_test.ts`, `handler_test.ts`, `index_test.ts` | 安全、競態與 adapter contract |
| Schema/RLS | 20260708、20260709、20260714 migrations | 核心表、角色 policy、audit 與 last-admin trigger |
| Import/reconciliation | 20260716–20260723 migrations | 匯入 RPC 演進、legacy production repair、ID reconciliation |
| Catalog/billing | 20260724–20260728 migrations | 帳務欄位、課程目錄、逐課收據與相容修正 |

---

### Task 1: Edge Function domain、handler 與 CORS 安全邊界

**Files:**
- Modify: `supabase/functions/_shared/cors.ts`
- Modify but do not stage/commit: `supabase/functions/admin-users/domain.ts`
- Modify: `supabase/functions/admin-users/handler.ts`
- Modify: `supabase/functions/admin-users/domain_test.ts`
- Modify: `supabase/functions/admin-users/handler_test.ts`

**Interfaces:**
- Consumes: bearer token、unknown JSON body、fresh Supabase actor、注入式 `HandlerDeps`
- Produces: stable JSON status/error、admin mutation、pending→success/failure audit lifecycle

- [ ] **Step 1: 保存重疊 staged 基線並執行 domain/handler 測試**

Run:

```powershell
git diff --cached -- supabase/functions/admin-users/domain.ts
git diff -- supabase/functions/admin-users/domain.ts
deno test supabase/functions/admin-users/domain_test.ts supabase/functions/admin-users/handler_test.ts
```

Expected: staged diff 顯示使用者既有 domain 變更；Deno 測試全部通過。若 Windows sandbox named-pipe 問題重現，使用既有核准的 `deno test` 權限在 sandbox 外執行，且不要改測試。

- [ ] **Step 2: 加入 CORS 與 domain 模組契約**

```ts
// _shared/cors.ts
/**
 * 產生 Edge Function 共用 CORS headers。
 * 呼叫端必須傳入精確 dashboard origin；不得使用 `*` 搭配 bearer credentials。
 */

// domain.ts
/**
 * `admin-users` 的純 domain 邊界：驗證 action 白名單、角色與 Email，
 * 套用目標帳號安全規則，並限制回傳前端的 user 欄位。
 */
```

為 domain 公開介面加入：

```ts
/** 驗證 request body 只含指定 action 的允許 keys，拒絕多餘欄位進入 privileged handler。 */
/** 將未知角色安全降級為 `viewer`；只用於讀取與輸出正規化。 */
/** 驗證 mutation 要求的角色，不接受未知值降級。 */
/** 正規化並驗證 Email，供重複檢查與刪除確認使用。 */
/** 只信任 fresh actor 的 `app_metadata.app_role` 判定管理員。 */
/** 禁止自我 mutation，並防止移除最後一位管理員。 */
/** 建立可安全回傳 UI 的 user 摘要，不洩漏 Auth user 其他 metadata。 */
```

- [ ] **Step 3: 加入 handler 驗證順序與 audit 原因**

在 `handler.ts` import 後加入：

```ts
/**
 * HTTP use-case 層：先驗證 bearer token 與 fresh actor，再解析白名單 action。
 * 讀取操作直接回傳安全摘要；mutation 必須建立 audit pending row，
 * 完成後再標記 success/failure，audit 寫入失敗視為整體操作失敗。
 */
```

在 handler 的相應位置加入：

```ts
// 必須以 token 向 Auth 重新取得 actor，不能只相信 client 傳入的 role 或舊 JWT 畫面狀態。
// body 白名單在 dispatch 前完成，避免 privileged adapter 收到未定義欄位。
// audit 先落 pending，確保後續 Supabase mutation 成敗都有可追溯的同一筆紀錄。
// 角色與刪除保護在最新 user list 上再次計算；UI disable 只用於降低誤觸。
// Email 確認先正規化再比較，避免大小寫或外側空白造成不一致行為。
```

- [ ] **Step 4: 為安全與 audit 測試補充原因**

在 `domain_test.ts` 的多餘欄位、unknown role、最後管理員案例前加入：

```ts
// privileged action 採 allowlist；即使額外欄位目前未使用也必須拒絕。
// 未知 stored role 在顯示時降級，但 mutation input 必須直接拒絕。
// handler guard 降低一般誤操作；資料庫 trigger 另處理並行 request 的最終競態。
```

在 `handler_test.ts` 的 fresh actor、audit failure、mutation failure 案例前加入：

```ts
// 這組案例確認每個 request 都重新查 actor，不沿用前端宣稱的管理員狀態。
// audit 建立失敗時 privileged mutation 不得開始，避免留下無紀錄的操作。
// mutation 失敗仍必須完成同一筆 audit 並保存 stable error code。
```

- [ ] **Step 5: 重跑測試並檢查 diff**

Run:

```powershell
deno test supabase/functions/admin-users/domain_test.ts supabase/functions/admin-users/handler_test.ts
git diff --check -- supabase/functions/_shared/cors.ts supabase/functions/admin-users/domain.ts supabase/functions/admin-users/handler.ts supabase/functions/admin-users/domain_test.ts supabase/functions/admin-users/handler_test.ts
git diff --cached -- supabase/functions/admin-users/domain.ts
git diff -- supabase/functions/_shared/cors.ts supabase/functions/admin-users/domain.ts supabase/functions/admin-users/handler.ts supabase/functions/admin-users/domain_test.ts supabase/functions/admin-users/handler_test.ts
```

Expected: 測試通過；新增內容只包含 comments；`domain.ts` 原 cached diff 不變。

- [ ] **Step 6: 只提交不重疊檔案**

```powershell
git commit --only -m "docs: explain admin edge security flow" -- supabase/functions/_shared/cors.ts supabase/functions/admin-users/handler.ts supabase/functions/admin-users/domain_test.ts supabase/functions/admin-users/handler_test.ts
```

Expected: `domain.ts` 不在 commit；其註解保留 unstaged。

### Task 2: Edge Function runtime adapter、環境與錯誤轉換

**Files:**
- Modify but do not stage/commit: `supabase/functions/admin-users/index.ts`
- Modify but do not stage/commit: `supabase/functions/admin-users/index_test.ts`

**Interfaces:**
- Consumes: `SUPABASE_URL`、service-role secret variants、redirect URLs、`ALLOWED_ORIGIN`
- Produces: `HandlerDeps` Supabase adapter、CORS-wrapped Deno handler、stable Auth errors

- [ ] **Step 1: 保存 staged 基線並執行 adapter 測試**

Run:

```powershell
git diff --cached -- supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
git diff -- supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
deno test supabase/functions/admin-users/index_test.ts
```

Expected: staged diff 保留使用者既有 runtime 變更；測試通過。

- [ ] **Step 2: 加入 runtime adapter 摘要與環境契約**

```ts
/**
 * Deno runtime adapter：解析管理權限環境變數、建立不持久化 session 的
 * service-role client，將 Supabase Auth／table errors 轉為 domain stable errors，
 * 最後為 handler response 套用固定來源 CORS。
 */

/** 解析 Supabase URL 與支援的 hosted/local secret 來源；缺少管理 secret 時立即停止啟動。 */
/** 將 Supabase client 包裝成可注入 handler 的 `HandlerDeps`，隔離 SDK 與 use-case 測試。 */
/** 建立 production handler；`ALLOWED_ORIGIN` 必須是單一精確來源且不可為 `*`。 */
```

在 secret precedence、error mapping、actor 與 audit mapping 旁加入：

```ts
// 優先使用平台標準 service-role 變數，再兼容本機與 hosted secret bundle。
// 對外只保留 stable code；Supabase message/details/hint 不直接回傳管理畫面。
// token 無效或過期轉為 `null`，由 handler 統一產生 `UNAUTHENTICATED` 401。
// adapter 負責 snake_case/camelCase 映射，domain/handler 不依賴資料表欄位格式。
```

- [ ] **Step 3: 為 adapter 測試補充非直覺原因**

在 `index_test.ts` 的 secret precedence、CORS wildcard、invalid token、redirect options 案例前加入：

```ts
// secret precedence 同時涵蓋 hosted 與 local 部署，避免測試環境意外遮蔽正式設定。
// bearer request 不能搭配 wildcard origin；runtime 必須在啟動時拒絕此設定。
// adapter 將 Auth 401/403 降為 null，stable 401 body 由 handler 唯一產生。
// invite 與 recovery 使用不同 redirect env，防止兩種郵件流程互相覆蓋。
```

- [ ] **Step 4: 重跑測試並確認只存在 unstaged comments**

Run:

```powershell
deno test supabase/functions/admin-users/index_test.ts
git diff --check -- supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
git diff --cached -- supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
git diff -- supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
```

Expected: 測試通過；cached diff 保持原樣，註解只位於 unstaged working-tree diff。不要提交這兩個檔案。

### Task 3: 核心 schema、角色 RLS 與管理員 audit migrations

**Files:**
- Modify: `supabase/migrations/20260708000000_student_management_schema.sql`
- Modify: `supabase/migrations/20260709000000_role_based_rls.sql`
- Modify: `supabase/migrations/20260714000000_admin_audit_logs.sql`

**Interfaces:**
- Consumes: Supabase `auth.users`／JWT `app_metadata`、PostgreSQL trigger/RLS
- Produces: `students`、`enrollments`、`courses`、role policies、`admin_audit_logs`、last-admin database guard

- [ ] **Step 1: 保存 SQL 非註解基線**

Run:

```powershell
git diff -- supabase/migrations/20260708000000_student_management_schema.sql supabase/migrations/20260709000000_role_based_rls.sql supabase/migrations/20260714000000_admin_audit_logs.sql
```

Expected: 任務開始前這三檔沒有本計畫造成的非註解變更。

- [ ] **Step 2: 加入每份 migration 的目的摘要**

```sql
-- 建立學員管理核心 schema：學員、季度報名與課程明細，以及最初的 authenticated RLS。
-- 這是後續 role policy、匯入 RPC 與帳務 schema 的前置 migration；已套用後不得從歷史刪除。

-- 將核心表從「所有 authenticated 使用者可寫」收斂為 `viewer`／`editor`／`admin` 角色權限。
-- `current_app_role()` 只讀 JWT `app_metadata`；前端 `usePermissions` 不參與資料庫授權。

-- 建立管理員操作 audit table，並以 `protect_last_auth_admin` trigger 防止 Auth metadata
-- 的並行更新或刪除移除最後一位管理員。Edge Function guard 不是此競態的最終防線。
```

- [ ] **Step 3: 在 schema、RLS 與 trigger 區塊加入決策原因**

```sql
-- `ON DELETE CASCADE` 讓學員／報名刪除時同步清理從屬資料，避免孤兒課程紀錄。
-- `set_updated_at` 由資料庫統一維護時間戳，避免不同 client 時鐘與漏傳欄位。
-- viewer 只讀、editor 可新增更新、admin 才可刪除；policy 與 table grant 必須同時允許操作。
-- audit table 不直接開放 authenticated CRUD，只能由持 service-role 的 Edge Function 寫入與讀取。
-- trigger 在 Auth row mutation 的同一資料庫交易中重新計數管理員，封住兩個 request 同時降級的競態。
```

把上述文字放在對應 table/trigger/policy 群組前，不在每條相似 policy 上重複。

- [ ] **Step 4: 檢查 SQL diff 並提交**

Run:

```powershell
git diff --check -- supabase/migrations/20260708000000_student_management_schema.sql supabase/migrations/20260709000000_role_based_rls.sql supabase/migrations/20260714000000_admin_audit_logs.sql
git diff --word-diff=porcelain -- supabase/migrations/20260708000000_student_management_schema.sql supabase/migrations/20260709000000_role_based_rls.sql supabase/migrations/20260714000000_admin_audit_logs.sql
git commit --only -m "docs: explain core schema security" -- supabase/migrations/20260708000000_student_management_schema.sql supabase/migrations/20260709000000_role_based_rls.sql supabase/migrations/20260714000000_admin_audit_logs.sql
```

Expected: diff 只增加 `--` comments；所有 SQL statement 文字與順序不變。

### Task 4: 季度匯入 RPC 演進與 legacy production repair

**Files:**
- Modify: `supabase/migrations/20260716000000_seasonal_import_rpc.sql`
- Modify: `supabase/migrations/20260716100000_merge_duplicate_season_enrollments.sql`
- Modify: `supabase/migrations/20260716120000_quarter_csv_import_rpc.sql`
- Modify: `supabase/migrations/20260717000000_restore_current_app_role.sql`
- Modify: `supabase/migrations/20260717120000_allow_provided_student_id_upsert.sql`

**Interfaces:**
- Consumes: canonical import JSON payload、existing student/enrollment/course rows、`current_app_role()`
- Produces: transaction-safe seasonal import、duplicate cleanup、CSV payload support、provided-ID upsert compatibility

- [ ] **Step 1: 加入 migration 目的摘要**

```sql
-- 首次建立 `import_season_data(jsonb)`：在單一 PostgreSQL function 中匯入學員、
-- 季度報名與課程，避免瀏覽器跨多表寫入留下部分完成狀態。

-- 在加入 student/season 唯一關係前清理已知歷史重複報名。
-- 每個保留 row 的選擇依資料完整度決定；這是一次性資料修復，不是通用去重演算法。

-- 擴充 `import_season_data` 以接受核准季度 CSV payload、來源列號與多季資料，
-- 並回傳可供 preview/result 顯示的匯入摘要。

-- 修復 migration history 已標記完成、但 legacy production schema 缺少
-- `current_app_role()` 的環境；顯式重建 helper 讓後續匯入 RPC 可執行。

-- 允許匯入 payload 提供可驗證的 `student_id`，同時保留缺少 ID 時由資料庫指派的路徑。
-- 此版本替換同名 RPC，是歷史相容演進，不得刪除較早 migration。
```

- [ ] **Step 2: 在交易、鎖與 identity 邏輯旁加入原因**

依實際 SQL anchor 放入：

```sql
-- transaction 由單一 function call 包住；任何 row 驗證或寫入失敗都回滾整批匯入。
-- advisory lock 序列化學員 ID 配發，避免兩批匯入同時讀到相同 next ID。
-- `(student_id, season)` 是報名身份；先 upsert enrollment，再以 payload 的完整課程集合重建關聯。
-- 提供的 ID 必須通過正規化與衝突檢查；缺少 ID 才進入自動配發流程。
-- `SECURITY DEFINER` 只用於受控 RPC；function 內仍以 `current_app_role()` 限制 editor/admin。
```

保留 `merge_duplicate...sql` 已有逐筆歷史理由，只把英文摘要翻譯為繁體中文並保留具體 student/season 選擇。

- [ ] **Step 3: 檢查 SQL diff 並提交**

Run:

```powershell
git diff --check -- supabase/migrations/20260716000000_seasonal_import_rpc.sql supabase/migrations/20260716100000_merge_duplicate_season_enrollments.sql supabase/migrations/20260716120000_quarter_csv_import_rpc.sql supabase/migrations/20260717000000_restore_current_app_role.sql supabase/migrations/20260717120000_allow_provided_student_id_upsert.sql
git diff --word-diff=porcelain -- supabase/migrations/20260716000000_seasonal_import_rpc.sql supabase/migrations/20260716100000_merge_duplicate_season_enrollments.sql supabase/migrations/20260716120000_quarter_csv_import_rpc.sql supabase/migrations/20260717000000_restore_current_app_role.sql supabase/migrations/20260717120000_allow_provided_student_id_upsert.sql
git commit --only -m "docs: explain seasonal import migrations" -- supabase/migrations/20260716000000_seasonal_import_rpc.sql supabase/migrations/20260716100000_merge_duplicate_season_enrollments.sql supabase/migrations/20260716120000_quarter_csv_import_rpc.sql supabase/migrations/20260717000000_restore_current_app_role.sql supabase/migrations/20260717120000_allow_provided_student_id_upsert.sql
```

Expected: diff 只增加或翻譯 SQL comments；function bodies、grants 與既有資料修復 statements 不變。

### Task 5: 學員 ID reconciliation 與帳務欄位 migration

**Files:**
- Modify: `supabase/migrations/20260723120000_student_id_reconciliation.sql`
- Modify: `supabase/migrations/20260724150000_add_enrollment_billing_fields.sql`

**Interfaces:**
- Consumes: legacy text/numeric student IDs、existing foreign keys、legacy enrollment billing
- Produces: canonical ID trigger、profile-update RPC、相容版 import RPC、enrollment billing columns

- [ ] **Step 1: 加入目的與相容性摘要**

```sql
-- 統一 legacy 學員 ID，讓 `students.student_id` 與從屬 `enrollments.student_id`
-- 使用同一 canonical 表示；同時提供可安全變更正式 ID 的 `update_student_profile` RPC。
-- 本 migration 也重建匯入 RPC，使 reconciliation 後的 schema 保持相同前端契約。

-- 在 `enrollments` 加入 legacy 報名層 `amount`、`invoice_number` 與退款欄位。
-- 後續逐課 `course_receipts` 上線後仍保留這些欄位，供舊資料 fallback 顯示。
```

- [ ] **Step 2: 解釋 trigger、cascade 與 legacy fallback**

```sql
-- `normalize_student_id` 是 DB canonical source；前端正規化只用於提早回饋。
-- `enforce_student_id` trigger 阻止繞過 UI/RPC 的非 canonical 寫入。
-- `update_student_profile` 在同一交易更新主 ID 與關聯 enrollment，避免暫時斷裂或孤兒資料。
-- 帳務欄位不搬移或推導逐課收據；它們只保存既有報名層資料供向下相容。
```

- [ ] **Step 3: 檢查並提交**

Run:

```powershell
git diff --check -- supabase/migrations/20260723120000_student_id_reconciliation.sql supabase/migrations/20260724150000_add_enrollment_billing_fields.sql
git diff --word-diff=porcelain -- supabase/migrations/20260723120000_student_id_reconciliation.sql supabase/migrations/20260724150000_add_enrollment_billing_fields.sql
git commit --only -m "docs: explain identity and billing migrations" -- supabase/migrations/20260723120000_student_id_reconciliation.sql supabase/migrations/20260724150000_add_enrollment_billing_fields.sql
```

Expected: 只有 SQL comments 變更。

### Task 6: 課程目錄、逐課收據與 production compatibility migrations

**Files:**
- Modify: `supabase/migrations/20260727190000_course_catalog_and_receipts.sql`
- Modify: `supabase/migrations/20260728100000_fix_enrollment_rpc_identifier_type.sql`
- Modify: `supabase/migrations/20260728120000_allow_course_receipt_delete.sql`
- Modify but do not stage/commit: `supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql`

**Interfaces:**
- Consumes: legacy course history/billing、role helper、existing enrollment identifiers
- Produces: `course_catalog`、`course_receipts`、catalog/receipt RLS、transactional enrollment update、production identifier compatibility、canonical Zumba label

- [ ] **Step 1: 保存未追蹤 migration 基線**

Run:

```powershell
git status --short -- supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
Get-Content -Raw -Encoding UTF8 supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
```

Expected: 檔案維持 untracked；記錄其原始 SQL 內容。不要對此檔執行 `git add` 或 `git commit --only`。

- [ ] **Step 2: 加入四份 migration 目的摘要**

```sql
-- 建立 canonical `course_catalog` 與逐課 `course_receipts`，從歷史課程／報名層帳務
-- 遷移可確定的資料，並提供交易型課程更新與 legacy import compatibility。
-- private helper 僅供 migration 內部資料搬移，不授權 app roles 直接呼叫。

-- production 的 `enrollments.enrollment_id` 使用 UUID，而早期 local schema 使用 bigint。
-- 將 RPC 參數改為 text 並在資料庫內比對，維持兩種已部署 schema 的 dashboard 契約。

-- 允許 editor 刪除 `course_receipts`，讓帳務 modal 能完成已確認的收據移除。
-- policy 與 table grant 需同時存在；前端確認框不構成授權。

-- 移除已棄用的 Zumba 課程名稱並確保 canonical 名稱啟用。
-- 這是 catalog 資料標準化，不改寫歷史報名上的課程文字。
```

- [ ] **Step 3: 解釋 migration 內部資料搬移、交易與 RLS**

在 `20260727190000...sql` 的對應區塊加入：

```sql
-- 歷史課程先匯入 catalog，讓既有名稱在新 picker 上線後仍可選取。
-- 只有能唯一對應單一課程的 legacy 帳務才搬成 receipt；多課程金額不可猜測分攤。
-- `update_enrollment_with_courses` 在同一交易更新報名與完整課程集合，避免部分刪除／新增。
-- 未開立收據的 course 才允許刪除，防止 cascade 意外抹除帳務憑證。
-- catalog/receipt RLS 沿用 viewer read、editor write；敏感刪除另以專用 policy 限制。
```

保留 `set_updated_at` 已有的 production self-contained 說明，翻譯為：

```sql
-- 初始 schema 應已建立此 helper，但部分 production migration history 曾與實際 schema 不一致；
-- 在此重建，讓本 migration 不依賴該環境外的人工修復。
```

- [ ] **Step 4: 檢查 tracked migrations 並只提交三個 tracked 檔**

Run:

```powershell
git diff --check -- supabase/migrations/20260727190000_course_catalog_and_receipts.sql supabase/migrations/20260728100000_fix_enrollment_rpc_identifier_type.sql supabase/migrations/20260728120000_allow_course_receipt_delete.sql supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
git diff --word-diff=porcelain -- supabase/migrations/20260727190000_course_catalog_and_receipts.sql supabase/migrations/20260728100000_fix_enrollment_rpc_identifier_type.sql supabase/migrations/20260728120000_allow_course_receipt_delete.sql
git commit --only -m "docs: explain course billing migrations" -- supabase/migrations/20260727190000_course_catalog_and_receipts.sql supabase/migrations/20260728100000_fix_enrollment_rpc_identifier_type.sql supabase/migrations/20260728120000_allow_course_receipt_delete.sql
```

Expected: tracked diff 只有 SQL comments；`20260728130000...sql` 保持 untracked，其新增註解留在 working tree。

- [ ] **Step 5: 人工比對未追蹤 migration**

Run:

```powershell
Get-Content -Raw -Encoding UTF8 supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
git status --short -- supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
```

Expected: 相較 Step 1 只新增檔頭 `--` 摘要；原本 DELETE/UPDATE/INSERT 或其他 statement 的文字與順序完全相同，狀態仍為 `??`。

### Task 7: Supabase 全域驗證與重疊變更盤點

**Files:**
- Verify: `supabase/functions/**/*.ts`
- Verify: `supabase/migrations/*.sql`

**Interfaces:**
- Consumes: Tasks 1–6 的 comments-only changes
- Produces: 通過測試且未改變 SQL 行為的後端註解批次

- [ ] **Step 1: 執行完整 Edge Function 測試**

Run:

```powershell
deno test supabase/functions/admin-users
```

Expected: 全部 Deno tests 通過。Windows sandbox 若再次發生 named-pipe panic，清除該次程序的 `SSLKEYLOGFILE` 並使用核准的 sandbox 外 `deno test`；不得以跳過測試作為完成依據。

- [ ] **Step 2: 執行 repository diff 檢查**

Run:

```powershell
git diff --check
git diff --word-diff=porcelain -- supabase/functions supabase/migrations
git status --short
```

Expected: 非既有使用者變更以外，Edge TypeScript 與 SQL 只增加 comments；沒有 statement、signature、assertion 或環境變數改動。

- [ ] **Step 3: 確認三個 staged Edge 檔與 untracked migration 未被提交**

Run:

```powershell
git diff --cached --name-only
git diff -- supabase/functions/admin-users/domain.ts supabase/functions/admin-users/index.ts supabase/functions/admin-users/index_test.ts
git status --short -- supabase/migrations/20260728130000_standardize_zumba_course_catalog.sql
```

Expected: `domain.ts`、`index.ts`、`index_test.ts` 仍保有原 staged 內容，新增註解位於 unstaged diff；`20260728130000...sql` 仍為 untracked。不得使用 restore/reset 清理這些狀態。
