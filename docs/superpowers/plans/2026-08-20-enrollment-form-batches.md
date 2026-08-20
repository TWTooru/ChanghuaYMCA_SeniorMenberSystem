# Enrollment Form Batches Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓同一位學員在同一期的一筆 enrollment 下保存多張可獨立編輯、收費及退費的報名表，同時維持既有學員、期別與收入統計正確。

**Architecture:** 保留 `enrollments` 的 `(student_id, period)` 唯一限制，新增 `enrollment_forms` 作為紙本報名表層級，並讓 courses 與 billing receipts 明確歸屬表單。所有跨表寫入改走交易型 Supabase RPC；前端資料載入後正規化為 `enrollment.forms[]`，既有期別畫面以 enrollment 彙總、表單明細畫面以 `form_id` 操作。

**Tech Stack:** PostgreSQL / Supabase migrations、RLS、PL/pgSQL RPC、pgTAP、React 19、Supabase JS、Vitest、Testing Library、Vite。

**Spec:** `docs/superpowers/specs/2026-08-20-enrollment-form-batches-design.md`

## Global Constraints

- 保留 `unique (student_id, period)`；第二張紙本不得建立第二筆 enrollment。
- 現有 enrollment 自動回填一張 sequence 1 表單，不要求使用者重填。
- `enrollment_forms` 是表單欄位來源；收據金額與 No. 只以 `billing_receipts` 為帳務來源。
- 新流程只建立 `prepaid` 與 `formal` 收據；無法分類的舊收據保留為唯讀 `other`。
- `reported_on` 是報到日期；既有 `enrollments.handled_on` 僅在遷移時映射到此欄位。
- 每張表可獨立退費；統計只排除已退費表單的課程與金額。
- 新 public table 必須啟用 RLS；authenticated 只能直接讀取，寫入只經過顯式授權 RPC。
- 所有 security-definer RPC 必須 `set search_path = ''`、檢查 `auth.uid()`、電子郵件及 `app_metadata.app_role`，並 revoke `PUBLIC`／`anon` 執行權。
- 執行 SQL 前依 Supabase skill 先檢查 `https://supabase.com/changelog.md`、目前 RLS 與 migration 官方文件；建立 migration 必須使用 `npx supabase migration new enrollment_form_batches`，不可手寫時間戳檔名。
- 不修改既有 migration；只新增 migration，並以 local reset 驗證從零重建。

## File Structure

### New files

- `supabase/tests/database/enrollment_forms_test.sql`：schema、同一期多表、表單更新／退費／刪除、權限與交易回滾的 pgTAP 規格。
- `supabase/migrations/<CLI timestamp>_enrollment_form_batches.sql`：由 Supabase CLI 建立；包含 schema、回填、RLS、helpers 與 public RPC。
- `dashboard/src/domain/enrollmentForms.js`：把巢狀 Supabase row 正規化為穩定的 form 與 enrollment 摘要形狀。
- `dashboard/src/domain/enrollmentForms.test.js`：正規化、部分退費與跨表課程彙總測試。
- `dashboard/src/components/enrollment/EnrollmentFormCard.jsx`：單張報名表檢視與 action 邊界。
- `dashboard/src/components/enrollment/EnrollmentFormCard.test.jsx`：表單顯示、編輯、退費與刪除 callback 測試。
- `dashboard/src/components/enrollment/EnrollmentFormEditor.jsx`：單張報名表編輯器；只產生 form payload。
- `dashboard/src/components/enrollment/EnrollmentFormEditor.test.jsx`：課程、費用、日期、備註與保留輸入的元件測試。

### Modified files

- `supabase/tests/database/create_member_initial_enrollment_test.sql`：初次報名改驗證 enrollment form。
- `supabase/tests/database/enrollment_period_test.sql`：保留期別唯一限制並驗證追加 form。
- `supabase/tests/database/billing_receipts_test.sql`：舊 RPC 建立的 receipt 歸類為 `other` 並帶 `form_id`。
- `dashboard/src/services/dashboardDataService.js` 及測試：載入 `enrollments → enrollment_forms → courses / billing_receipts`。
- `dashboard/src/domain/enrollmentBilling.js` 及測試：按表單收據種類彙總，停止優先讀取 enrollment 舊帳務欄位。
- `dashboard/src/services/enrollmentService.js` 及測試：改用 form-level create/update/refund/delete RPC，另保留 parent period update。
- `dashboard/src/services/studentService.js` 及測試：初次報名 payload 改用 `reported_on` 並接收 `form_id`。
- `dashboard/src/domain/initialEnrollment.js` 及測試：正規化 `reported_on`。
- `dashboard/src/components/enrollment/AddEnrollModal.jsx` 及測試：同一期顯示追加提示並建立下一張表。
- `dashboard/src/components/students/AddStudentModal.jsx`、`InitialEnrollmentStep.jsx` 及測試：第一張報名表使用新欄位名稱與資料形狀。
- `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx` 及測試：成為期別下多張 form 的協調 modal。
- `dashboard/src/components/enrollment/EnrollmentEditForm.jsx` 及測試：只編輯 enrollment 的期別與起訖日，不再改課程／帳務。
- `dashboard/src/components/enrollment/EnrollmentTimeline.jsx`、`EnrollmentTab.jsx`、`StudentDetailModal.jsx`、`App.jsx` 及測試：顯示 form 群組、部分退費與正確選取。
- `dashboard/src/hooks/useStats.js` 及測試：人數按 enrollment、課程與收入按有效 form 計算。
- `dashboard/src/lib/excelExport.js` 及測試：每張 form 匯出一列。
- `dashboard/src/components/enrollment/enrollment.css`、`enrollmentBillingDetail.css`：多表卡片、追加提示與部分退費樣式。

---

### Task 1: Add the Enrollment Form Schema and Atomic RPCs

**Files:**

- Create: `supabase/tests/database/enrollment_forms_test.sql`
- Create via CLI: `supabase/migrations/<CLI timestamp>_enrollment_form_batches.sql`
- Modify: `supabase/tests/database/create_member_initial_enrollment_test.sql`
- Modify: `supabase/tests/database/enrollment_period_test.sql`
- Modify: `supabase/tests/database/billing_receipts_test.sql`

**Interfaces:**

- Produces: `public.enrollment_forms` and `courses.form_id`.
- Produces: `billing_receipts.form_id` and `receipt_kind in ('prepaid','formal','other')`.
- Produces: `create_member_enrollment(bigint,jsonb) -> jsonb` returning `enrollment_id`, `form_id`, `form_sequence`, `appended`.
- Produces: `update_enrollment_form(bigint,jsonb) -> jsonb`.
- Produces: `set_enrollment_form_refund(bigint,boolean,text) -> jsonb`.
- Produces: `delete_enrollment_form(bigint) -> jsonb`.
- Produces: `update_enrollment_period(bigint,text,date,date) -> jsonb`.
- Preserves: `create_student_with_initial_enrollment(jsonb,jsonb) -> jsonb`, now also returning `form_id`.

- [ ] **Step 1: Write the failing pgTAP contract**

Create `supabase/tests/database/enrollment_forms_test.sql` with a transaction, `select plan(28)`, a clean student fixture, and assertions covering this exact scenario:

```sql
select has_table('public', 'enrollment_forms', 'paper enrollment forms exist');
select col_is_pk('public', 'enrollment_forms', 'form_id', 'form_id is the primary key');
select has_column('public', 'courses', 'form_id', 'courses belong to a form');
select has_column('public', 'billing_receipts', 'form_id', 'receipts belong to a form');
select has_column('public', 'billing_receipts', 'receipt_kind', 'receipts expose their kind');
select has_function('public', 'update_enrollment_form', array['bigint', 'jsonb'], 'form update RPC exists');
select has_function('public', 'set_enrollment_form_refund', array['bigint', 'boolean', 'text'], 'form refund RPC exists');
select has_function('public', 'delete_enrollment_form', array['bigint'], 'form delete RPC exists');
select has_function('public', 'update_enrollment_period', array['bigint', 'text', 'date', 'date'], 'period update RPC exists');
```

Set an editor JWT with both `sub` and `email`, insert one student and four catalog courses, then call `create_member_enrollment` twice with the same period:

```sql
select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor@example.com","app_metadata":{"app_role":"editor"}}',
  true
);

select pg_catalog.set_config('test.form_one', public.create_member_enrollment(
  9001,
  '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程A","課程B"],"prepaid_amount":500,"prepaid_receipt_number":"P-1","tuition_fee":2000,"materials_fee":200,"membership_fee":100,"fee_receipt_number":"F-1","handled_by_name":"王承辦","reported_on":"2026-08-20","notes":"第一張"}'::jsonb
)::text, true);

select pg_catalog.set_config('test.form_two', public.create_member_enrollment(
  9001,
  '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["課程C","課程D"],"prepaid_amount":300,"prepaid_receipt_number":"P-2","tuition_fee":1800,"materials_fee":100,"membership_fee":0,"fee_receipt_number":"F-2","handled_by_name":"李承辦","reported_on":"2026-08-21","notes":"第二張"}'::jsonb
)::text, true);
```

Assert one enrollment, two form rows with sequence 1/2, four courses split 2/2, four typed receipts with the exact No. values, the two different handler/date/note snapshots, and `appended = false/true`. Add failures for a duplicate course across forms (`COURSE_ALREADY_SELECTED`), mismatched existing period dates (`PERIOD_DATES_MISMATCH`), invalid reported date (`REPORTED_ON_INVALID`), a receipt spanning two forms (`PAYMENT_FORM_MISMATCH`), and viewer mutation (`42501`). Exercise `update_enrollment_form`, form-only refund, form delete, and a trigger-induced course insert failure that leaves no partial form or receipts.

- [ ] **Step 2: Run the new database test and verify the contract fails**

Run from repository root:

```powershell
npx supabase test db --local supabase/tests/database/enrollment_forms_test.sql
```

Expected: FAIL because `public.enrollment_forms` and the form RPCs do not exist.

- [ ] **Step 3: Create the migration through the CLI**

Run:

```powershell
npx supabase migration new enrollment_form_batches
```

Use the exact generated file ending in `_enrollment_form_batches.sql` for every SQL change below. Do not edit an older migration.

- [ ] **Step 4: Implement schema, backfill, constraints, indexes and RLS**

In the new migration, wrap the migration in `begin; ... commit;` and create this table shape:

```sql
create table public.enrollment_forms (
  form_id bigint generated by default as identity primary key,
  enrollment_id bigint not null references public.enrollments(enrollment_id) on delete cascade,
  form_sequence integer not null check (form_sequence > 0),
  reg_type text,
  tuition_fee integer check (tuition_fee is null or tuition_fee >= 0),
  materials_fee integer check (materials_fee is null or materials_fee >= 0),
  membership_fee integer check (membership_fee is null or membership_fee >= 0),
  handled_by_name text,
  handled_by_user_id uuid,
  handled_by_account text,
  reported_on date,
  notes text,
  refunded boolean not null default false,
  refund_info text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint enrollment_forms_enrollment_sequence_key unique (enrollment_id, form_sequence),
  constraint enrollment_forms_form_enrollment_key unique (form_id, enrollment_id)
);

create index enrollment_forms_enrollment_id_idx on public.enrollment_forms(enrollment_id);
```

Insert one sequence-1 form per existing enrollment, copying `reg_type`, fee fields, handler audit, `handled_on -> reported_on`, notes, integer refund flag and `refund_info`. Add `courses.form_id`, backfill it from that form, set it not null, index it, and add a composite cascade foreign key `(form_id, enrollment_id)` to `enrollment_forms(form_id, enrollment_id)` while retaining `unique (enrollment_id, course_name)`.

Add nullable `form_id` and `receipt_kind` to `billing_receipts`. Derive `form_id` through `billing_receipt_courses -> courses`; abort if a receipt spans multiple forms or has no course. Classify a receipt as `prepaid` or `formal` only when its amount and No. uniquely match the copied enrollment fields; otherwise use `other`. Then set both columns not null, add the form FK/index, add a check for the three kinds, and add:

```sql
create unique index billing_receipts_one_typed_kind_per_form_uidx
on public.billing_receipts(form_id, receipt_kind)
where receipt_kind in ('prepaid', 'formal');
```

Replace the existing receipt-course consistency trigger with `enforce_billing_receipt_single_form`: every inserted/updated link must have `billing_receipts.form_id = courses.form_id`; otherwise raise `PAYMENT_FORM_MISMATCH`. This is stricter than checking only the parent enrollment and prevents a receipt from crossing two paper forms.

Enable RLS on `enrollment_forms`, revoke all default table/sequence access, grant authenticated select only, and create one authenticated select policy using:

```sql
using ((select public.current_app_role()) in ('viewer', 'editor', 'admin'))
```

- [ ] **Step 5: Implement shared private form writers and public RPCs**

Define private helpers with explicit signatures and revoke them from all client roles:

```sql
private.create_enrollment_form_records(
  p_enrollment_id bigint,
  p_form jsonb,
  p_actor_user_id uuid,
  p_actor_account text
) returns jsonb

private.update_enrollment_form_records(
  p_form_id bigint,
  p_form jsonb,
  p_actor_user_id uuid,
  p_actor_account text
) returns jsonb
```

Both helpers must normalize case-insensitive course names, require at least one course, reject a course already present anywhere in the parent enrollment, parse nonnegative integer fees with `private.optional_nonnegative_integer`, validate `reported_on` as a real `YYYY-MM-DD` date, trim text fields, and maintain receipts and `billing_receipt_courses` in the same transaction. On update, reject removal of a course linked to an `other` receipt with `COURSE_RECEIPT_LOCKED`; otherwise delete the form's typed receipt-course links, synchronize course rows, upsert/delete the `prepaid` and `formal` receipt rows, then recreate links from each typed receipt to every current form course. Never modify `other` receipts.

Replace `create_member_enrollment(bigint,jsonb)` so it locks or creates the parent enrollment. If an enrollment already exists with dates, require supplied start/end dates to equal the stored dates and set `appended = true`; if a historical enrollment has both dates null, fill them from the valid supplied dates before appending. Otherwise insert the parent and set `appended = false`. Call `private.create_enrollment_form_records` and return:

```sql
jsonb_build_object(
  'student_id', p_student_id,
  'enrollment_id', v_enrollment_id,
  'form_id', v_form -> 'form_id',
  'form_sequence', v_form -> 'form_sequence',
  'appended', v_appended
)
```

Replace `create_student_with_initial_enrollment(jsonb,jsonb)` to create the student and parent enrollment, then call the same private form writer. Add the four public RPCs listed in Interfaces. `set_enrollment_form_refund` updates only the selected form. `delete_enrollment_form` requires admin, deletes that form, and deletes the parent enrollment only when no forms remain. `update_enrollment_period` updates only period/start/end after canonical format/date-order/uniqueness checks.

Update legacy `create_enrollment_with_courses`, `update_enrollment_with_courses` and `create_billing_receipt` bodies so every new course/receipt receives a form. Legacy standalone receipts use `receipt_kind = 'other'`; legacy update is allowed only when the enrollment has exactly one form and otherwise raises `ENROLLMENT_HAS_MULTIPLE_FORMS`. Drop the stale migration-only function `private.migrate_legacy_billing_receipts()` so database lint no longer analyzes obsolete SQL.

For every public security-definer RPC, revoke execute from `PUBLIC`, `anon`, and `authenticated`, then grant only the intended signature to `authenticated`. Check editor/admin for create/update/refund and admin for physical delete.

- [ ] **Step 6: Update the existing pgTAP expectations**

Change `create_member_initial_enrollment_test.sql` to assert returned `form_id`, form-level paper fields, `reported_on`, actor audit, typed receipts and courses with the same `form_id`. Keep the spoofed actor assertions.

Change `enrollment_period_test.sql` to retain the duplicate direct enrollment constraint test while adding that `create_member_enrollment` appends a form rather than a second enrollment.

Change `billing_receipts_test.sql` so the legacy grouped receipt has the default form's `form_id` and `receipt_kind = 'other'`; update the legacy update test to remove a course only when it has no linked receipt.

- [ ] **Step 7: Reset local Supabase and run all database checks**

Run:

```powershell
npx supabase db reset --local
npx supabase test db --local supabase/tests/database
npx supabase db lint --local --schema public,private --level warning --fail-on error
npx supabase db advisors --local --type all --level info --fail-on error
```

Expected: reset succeeds; all pgTAP tests pass; lint has no error; advisors has no error and does not report an unindexed new foreign key.

- [ ] **Step 8: Commit the database boundary**

```powershell
git add supabase/migrations/*_enrollment_form_batches.sql supabase/tests/database/enrollment_forms_test.sql supabase/tests/database/create_member_initial_enrollment_test.sql supabase/tests/database/enrollment_period_test.sql supabase/tests/database/billing_receipts_test.sql
git commit -m "feat: add enrollment form batch data model"
```

---

### Task 2: Normalize Enrollment Forms in the Dashboard Snapshot

**Files:**

- Create: `dashboard/src/domain/enrollmentForms.js`
- Create: `dashboard/src/domain/enrollmentForms.test.js`
- Modify: `dashboard/src/domain/enrollmentBilling.js`
- Modify: `dashboard/src/domain/enrollmentBilling.test.js`
- Modify: `dashboard/src/services/dashboardDataService.js`
- Modify: `dashboard/src/services/dashboardDataService.test.js`

**Interfaces:**

- Produces: `normalizeEnrollmentForm(rawForm) -> EnrollmentForm`.
- Produces: `normalizeEnrollmentForms(rawForms) -> EnrollmentForm[]` sorted by `form_sequence`.
- Produces: `getEnrollmentRefundStatus(forms) -> 'normal' | 'partial' | 'refunded'`.
- Produces: normalized enrollment properties `forms`, flattened `courses`, `formCount`, `refundStatus`, `refunded`.
- Produces: `summarizeEnrollmentFormBilling(form)` and form-aware `summarizeEnrollmentBilling(enrollment)`.

- [ ] **Step 1: Write failing domain-shape tests**

Create raw fixtures with two forms, each two courses and distinct `prepaid`/`formal` receipts. Assert this stable shape:

```javascript
expect(normalizeEnrollmentForms(rawForms)).toEqual([
  expect.objectContaining({
    form_id: 11,
    form_sequence: 1,
    courses: ['課程A', '課程B'],
    prepaid_amount: 500,
    prepaid_receipt_number: 'P-1',
    fee_receipt_number: 'F-1',
    reported_on: '2026-08-20',
    refunded: false,
  }),
  expect.objectContaining({
    form_id: 12,
    form_sequence: 2,
    courses: ['課程C', '課程D'],
    prepaid_amount: 300,
    fee_receipt_number: 'F-2',
    refunded: true,
  }),
])
expect(getEnrollmentRefundStatus(forms)).toBe('partial')
```

Add billing tests proving form summaries use typed receipts, preserve `otherReceipts` for display, and enrollment totals exclude refunded forms by default.

- [ ] **Step 2: Run the targeted tests and verify they fail**

Run in `dashboard`:

```powershell
npx vitest run src/domain/enrollmentForms.test.js src/domain/enrollmentBilling.test.js src/services/dashboardDataService.test.js
```

Expected: FAIL because the form normalizer and nested query do not exist.

- [ ] **Step 3: Implement the normalizers and billing summaries**

Implement `normalizeEnrollmentForm` with this output contract:

```javascript
{
  ...rawForm,
  refunded: Boolean(rawForm.refunded),
  courses: ['課程A', '課程B'],
  courseDetails: [{ courseId: 101, courseName: '課程A' }],
  billingReceipts: [{ receiptId: 201, receiptKind: 'prepaid', amount: 500, invoiceNumber: 'P-1' }],
  prepaid_amount: 500,
  prepaid_receipt_number: 'P-1',
  fee_receipt_number: 'F-1',
  otherReceipts: [],
}
```

`getEnrollmentRefundStatus` returns `normal` when none are refunded, `refunded` when at least one form exists and all are refunded, and `partial` otherwise. `summarizeEnrollmentFormBilling` returns `{ prepaidAmount, formalAmount, prepaidReceiptNumber, formalReceiptNumber, invoiceNumbers }`, where `formalAmount` is the sum of the three fee components. `summarizeEnrollmentBilling` returns `{ amount, prepaidAmount, invoiceNumbers, source: 'forms' }`; `amount` is the sum of active forms' formal amounts and `prepaidAmount` is summed separately, unless `{ includeRefunded: true }` is supplied.

- [ ] **Step 4: Update the Supabase query and enrollment aggregation**

Change the enrollment select expression to:

```javascript
'*, enrollment_forms(*, courses(*), billing_receipts(*))'
```

For each raw enrollment, call `normalizeEnrollmentForms`, flatten all form courses, set `formCount`, set `refundStatus`, and retain `refunded: refundStatus === 'refunded'` only as a compatibility aggregate. Do not read enrollment-level fee, receipt, handler or note fields into summaries.

- [ ] **Step 5: Run the targeted tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 6: Commit the normalized read model**

```powershell
git add dashboard/src/domain/enrollmentForms.js dashboard/src/domain/enrollmentForms.test.js dashboard/src/domain/enrollmentBilling.js dashboard/src/domain/enrollmentBilling.test.js dashboard/src/services/dashboardDataService.js dashboard/src/services/dashboardDataService.test.js
git commit -m "feat: normalize enrollment form batches"
```

---

### Task 3: Replace Enrollment Mutations with Form-Level Services

**Files:**

- Modify: `dashboard/src/services/enrollmentService.js`
- Modify: `dashboard/src/services/enrollmentService.test.js`
- Modify: `dashboard/src/services/studentService.js`
- Modify: `dashboard/src/services/studentService.test.js`
- Modify: `dashboard/src/domain/initialEnrollment.js`
- Modify: `dashboard/src/domain/initialEnrollment.test.js`

**Interfaces:**

- Produces: `createEnrollmentForm(client, studentId, form)`.
- Produces: `updateEnrollmentForm(client, formId, form)`.
- Produces: `updateEnrollmentFormRefundStatus(client, formId, refunded, refundInfo)`.
- Produces: `deleteEnrollmentForm(client, formId)`.
- Produces: `updateEnrollmentPeriod(client, enrollmentId, periodData)`.
- Removes frontend usage of direct `.from('enrollments').update(...)` for form billing/refund fields.

- [ ] **Step 1: Write failing service tests**

Assert exact RPC payloads and responses:

```javascript
await expect(createEnrollmentForm(client, 7, form)).resolves.toEqual({
  enrollment_id: 40,
  form_id: 42,
  form_sequence: 2,
  appended: true,
})
expect(client.rpc).toHaveBeenCalledWith('create_member_enrollment', {
  p_student_id: 7,
  p_enrollment: expect.objectContaining({ reported_on: '2026-08-20' }),
})

await updateEnrollmentForm(client, 42, form)
expect(client.rpc).toHaveBeenCalledWith('update_enrollment_form', {
  p_form_id: 42,
  p_form: expect.any(Object),
})
```

Add exact calls for `set_enrollment_form_refund`, `delete_enrollment_form`, and `update_enrollment_period`. Assert error-code mappings for `COURSE_ALREADY_SELECTED`, `PERIOD_DATES_MISMATCH`, `REPORTED_ON_INVALID`, `ENROLLMENT_FORM_NOT_FOUND`, and forbidden operations.

- [ ] **Step 2: Run service/domain tests and verify failure**

```powershell
npx vitest run src/services/enrollmentService.test.js src/services/studentService.test.js src/domain/initialEnrollment.test.js
```

Expected: FAIL because the new service exports and `reported_on` normalizer are absent.

- [ ] **Step 3: Implement form payload normalization and service calls**

Rename optional input `handled_on` to `reported_on` in `normalizeInitialEnrollmentForm`; keep period, date-order, course and nonnegative integer validation unchanged. Implement the five service exports listed above and normalize all ids with `Number(...)`.

Remove `updateEnrollmentBillingDetails` and `updateEnrollmentRefundStatus` after replacing their tests with the form-level calls. Keep `deleteEnrollment` for deleting an entire period. Retain `createEnrollmentWithCourses` only as a deprecated alias of `createEnrollmentForm` until all component imports are changed in Task 4, then remove the alias and its old expectation.

Update `createStudentWithInitialEnrollment` to pick `reported_on` and to return `{ student_id, enrollment_id, form_id }` from the RPC response.

- [ ] **Step 4: Run the tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the service boundary**

```powershell
git add dashboard/src/services/enrollmentService.js dashboard/src/services/enrollmentService.test.js dashboard/src/services/studentService.js dashboard/src/services/studentService.test.js dashboard/src/domain/initialEnrollment.js dashboard/src/domain/initialEnrollment.test.js
git commit -m "refactor: use enrollment form mutation services"
```

---

### Task 4: Create and Append Forms from Existing Entry Flows

**Files:**

- Modify: `dashboard/src/App.jsx`
- Modify: `dashboard/src/App.test.jsx`
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.jsx`
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.test.jsx`
- Modify: `dashboard/src/components/students/AddStudentModal.jsx`
- Modify: `dashboard/src/components/students/AddStudentModal.test.jsx`
- Modify: `dashboard/src/components/students/InitialEnrollmentStep.jsx`
- Modify: `dashboard/src/components/students/InitialEnrollmentStep.test.jsx`
- Modify: `dashboard/src/components/enrollment/enrollment.css`

**Interfaces:**

- Consumes: `createEnrollmentForm` from Task 3.
- Consumes: normalized `enrollments[].forms` from Task 2.
- Produces: `AddEnrollModal({ student, enrollments, onClose, onRefresh, defaultPeriod })`.

- [ ] **Step 1: Write failing append-flow tests**

Render `AddEnrollModal` with an existing 第16期 enrollment containing form sequence 1 and courses A/B. Select 第16期 and assert:

```javascript
expect(screen.getByRole('status')).toHaveTextContent('已有本期報名，將新增第 2 張報名表')
expect(screen.getByText('既有課程：課程A、課程B')).toBeTruthy()
expect(screen.getByLabelText('開始日期 *')).toHaveValue('2026-09-01')
expect(screen.getByLabelText('開始日期 *')).toBeDisabled()
```

Select C/D, submit, and assert `createEnrollmentForm` receives the canonical period, existing parent dates, two new courses and separate No. values. Add a test that selecting an existing course is blocked before RPC. Update initial-member tests to assert `reported_on` and the label `報到日期`.

- [ ] **Step 2: Run the entry-flow tests and verify failure**

```powershell
npx vitest run src/components/enrollment/AddEnrollModal.test.jsx src/components/students/InitialEnrollmentStep.test.jsx src/components/students/AddStudentModal.test.jsx src/App.test.jsx
```

Expected: FAIL because the modal has no `enrollments` prop or append notice and still uses `handled_on`.

- [ ] **Step 3: Implement append detection and field naming**

In `App.jsx`, pass only the selected student's enrollment rows:

```jsx
<AddEnrollModal
  student={selectedStudent}
  enrollments={enrollments.filter(item => String(item.student_id) === String(selectedStudent.student_id))}
  onClose={() => setShowAddEnrollModal(false)}
  onRefresh={handleRefresh}
/>
```

In `AddEnrollModal`, derive `existingEnrollment` from the normalized selected period. If present, display the status notice, use `formCount + 1`, copy and disable the parent date fields, and pass all existing enrollment courses as `lockedCourseNames` to `CourseTagPicker`. Submit through `createEnrollmentForm` and change the success copy to `已新增第 N 張報名表` when `appended` is true.

Rename local state/input `handled_on` to `reported_on` in AddEnrollModal, AddStudentModal and InitialEnrollmentStep; change visible copy from `辦理日期` to `報到日期`. Do not rename the authenticated actor account fields.

After `AddEnrollModal` imports `createEnrollmentForm`, remove the temporary `createEnrollmentWithCourses` alias from `enrollmentService.js` and update any remaining mocks to the final export name.

- [ ] **Step 4: Run the entry-flow tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the creation flows**

```powershell
git add dashboard/src/App.jsx dashboard/src/App.test.jsx dashboard/src/components/enrollment/AddEnrollModal.jsx dashboard/src/components/enrollment/AddEnrollModal.test.jsx dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/AddStudentModal.test.jsx dashboard/src/components/students/InitialEnrollmentStep.jsx dashboard/src/components/students/InitialEnrollmentStep.test.jsx dashboard/src/components/enrollment/enrollment.css
git commit -m "feat: append enrollment forms within a period"
```

---

### Task 5: Add Form Cards, Editing, Refund and Deletion

**Files:**

- Create: `dashboard/src/components/enrollment/EnrollmentFormCard.jsx`
- Create: `dashboard/src/components/enrollment/EnrollmentFormCard.test.jsx`
- Create: `dashboard/src/components/enrollment/EnrollmentFormEditor.jsx`
- Create: `dashboard/src/components/enrollment/EnrollmentFormEditor.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx`
- Modify: `dashboard/src/components/enrollment/enrollmentBillingDetail.css`

**Interfaces:**

- Consumes: form mutation services from Task 3.
- Produces: `EnrollmentFormCard({ form, canEdit, canDelete, onEdit, onToggleRefund, onDelete })`.
- Produces: `EnrollmentFormEditor({ form, siblingCourseNames, onSave, onCancel })`.
- Produces: `EnrollmentBillingDetailModal` rendering `enrollment.forms` instead of enrollment-level billing fields.

- [ ] **Step 1: Write failing form-card and editor tests**

Assert a card headed `報名表 2` renders its own C/D courses, `P-2`, `F-2`, handler, reported date, note and refund badge without showing form 1 values. Assert action callbacks receive `form_id`.

For the editor, change courses and all form fields, save, and assert:

```javascript
expect(updateEnrollmentForm).toHaveBeenCalledWith(
  expect.anything(),
  12,
  expect.objectContaining({
    courses: ['課程C', '課程D'],
    prepaid_amount: 300,
    prepaid_receipt_number: 'P-2',
    fee_receipt_number: 'F-2',
    reported_on: '2026-08-21',
    notes: '第二張',
  }),
)
```

Add tests that sibling courses are locked, invalid amount remains in edit mode with an alert, save failure preserves inputs, refund calls only `set_enrollment_form_refund`, and admin delete calls only `delete_enrollment_form` after confirmation.

- [ ] **Step 2: Run the component tests and verify failure**

```powershell
npx vitest run src/components/enrollment/EnrollmentFormCard.test.jsx src/components/enrollment/EnrollmentFormEditor.test.jsx src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
```

Expected: FAIL because the new components do not exist and the modal still edits enrollment columns directly.

- [ ] **Step 3: Implement focused form components**

`EnrollmentFormEditor` owns only editable form state and delegates course choice to `CourseTagPicker`. Its `lockedCourseNames` is the sibling-course list, not the current form's receipt-linked courses, because the atomic RPC safely rewrites current form receipt links. It calls `updateEnrollmentForm`, preserves state on error, disables all controls in flight, and calls `onSave` only after success.

`EnrollmentFormCard` is display-only except for explicit actions. Show prepaid and formal sections separately, list `otherReceipts` under `歷史收據`, and render `報到日期` from `reported_on`.

Refactor `EnrollmentBillingDetailModal` into a coordinator: keep focus trap and unsaved-change guard, render parent student/period/start/end summary once, map sorted `enrollment.forms` to cards, allow only one editor at a time, and use existing `ConfirmDialog` for refund/delete. On successful mutation call `onRefresh` once. Delete all direct use of `updateEnrollmentBillingDetails` and enrollment-level refund fields.

- [ ] **Step 4: Run the component tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the form detail UI**

```powershell
git add dashboard/src/components/enrollment/EnrollmentFormCard.jsx dashboard/src/components/enrollment/EnrollmentFormCard.test.jsx dashboard/src/components/enrollment/EnrollmentFormEditor.jsx dashboard/src/components/enrollment/EnrollmentFormEditor.test.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx dashboard/src/components/enrollment/enrollmentBillingDetail.css
git commit -m "feat: manage enrollment forms independently"
```

---

### Task 6: Preserve Period Editing and Update History Views

**Files:**

- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTimeline.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentTab.test.jsx`
- Modify: `dashboard/src/components/students/StudentDetailModal.jsx`
- Modify: `dashboard/src/components/students/StudentDetailForms.test.jsx`
- Modify: `dashboard/src/components/students/StudentDetailComponents.test.jsx`
- Modify: `dashboard/src/components/enrollment/enrollment.css`

**Interfaces:**

- Consumes: `updateEnrollmentPeriod` from Task 3.
- Consumes: `formCount`, `refundStatus`, flattened `courses` and form-aware billing summary from Task 2.
- Preserves: one timeline/table row per student-period enrollment.

- [ ] **Step 1: Write failing history-view tests**

Add a two-form enrollment fixture and assert timeline/table behavior:

```javascript
expect(screen.getByText('2 張報名表')).toBeTruthy()
expect(screen.getByText('部分退費')).toBeTruthy()
expect(screen.getByText('課程A')).toBeTruthy()
expect(screen.getByText('課程D')).toBeTruthy()
```

Assert clicking the period row/card still sends the whole enrollment to `EnrollmentBillingDetailModal`. Assert refund filters distinguish `normal`, `partial`, and `refunded`. Update `EnrollmentEditForm` tests so save calls `updateEnrollmentPeriod` with canonical period and the two dates and never sends courses, receipts or refund state.

- [ ] **Step 2: Run the history tests and verify failure**

```powershell
npx vitest run src/components/enrollment/EnrollmentEditForm.test.jsx src/components/enrollment/EnrollmentTimeline.test.jsx src/components/enrollment/EnrollmentTab.test.jsx src/components/students/StudentDetailForms.test.jsx src/components/students/StudentDetailComponents.test.jsx
```

Expected: FAIL because current views use one enrollment-level refund/fee set.

- [ ] **Step 3: Make outer history components form-aware**

Reduce `EnrollmentEditForm` to period, start date and end date inputs and call `updateEnrollmentPeriod`. Keep course, reg type, refund and billing editing exclusively inside form cards.

In `EnrollmentTimeline`, display one outer item per period, show `${formCount} 張報名表`, flattened course tags, active-form totals and a badge chosen from `normal/partial/refunded`. Keep entire-period deletion through `deleteEnrollment`; its confirmation copy must say all forms in the period will be deleted.

In `EnrollmentTab`, search flattened courses, add `<option value="partial">部分退費</option>`, derive filtering from `refundStatus`, and render active-form billing totals. Preserve one row per enrollment and the existing student lookup/click behavior.

Update `StudentDetailModal` tests to prove opening a two-form enrollment shows both cards and closing the nested modal restores focus.

- [ ] **Step 4: Run the history tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit the history views**

```powershell
git add dashboard/src/components/enrollment/EnrollmentEditForm.jsx dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx dashboard/src/components/enrollment/EnrollmentTimeline.jsx dashboard/src/components/enrollment/EnrollmentTimeline.test.jsx dashboard/src/components/enrollment/EnrollmentTab.jsx dashboard/src/components/enrollment/EnrollmentTab.test.jsx dashboard/src/components/students/StudentDetailModal.jsx dashboard/src/components/students/StudentDetailForms.test.jsx dashboard/src/components/students/StudentDetailComponents.test.jsx dashboard/src/components/enrollment/enrollment.css
git commit -m "feat: show form batches in enrollment history"
```

---

### Task 7: Make Statistics and Export Form-Aware

**Files:**

- Modify: `dashboard/src/hooks/useStats.js`
- Modify: `dashboard/src/hooks/useStats.test.js`
- Modify: `dashboard/src/hooks/useStats.period.test.js`
- Modify: `dashboard/src/lib/excelExport.js`
- Modify: `dashboard/src/lib/excelExport.test.js`
- Modify: `dashboard/src/hooks/useExportHandler.test.js`

**Interfaces:**

- Consumes: normalized `enrollment.forms`.
- Produces: enrollment-count statistics plus active-form courses/revenue/prepaid and refunded-form counts.
- Produces: one export row per enrollment form.

- [ ] **Step 1: Write failing statistics and export tests**

Use one 第16期 enrollment with two forms, one active and one refunded. Assert:

```javascript
expect(result.current.totalRegistrations).toBe(1)
expect(result.current.totalRefunds).toBe(1)
expect(result.current.totalRevenue).toBe(2300)
expect(result.current.totalPrepaid).toBe(500)
expect(result.current.periodStats[0]).toMatchObject({
  enrollments: 1,
  forms: 2,
  refunds: 1,
  courses: 2,
  revenue: 2300,
  prepaid: 500,
})
```

Assert export produces two rows with repeated student/period columns but different `報名表序號`, courses, refund state, receipts, handler, `報到日期` and notes.

- [ ] **Step 2: Run targeted tests and verify failure**

```powershell
npx vitest run src/hooks/useStats.test.js src/hooks/useStats.period.test.js src/lib/excelExport.test.js src/hooks/useExportHandler.test.js
```

Expected: FAIL because current code reads enrollment-level fees and exports one row per enrollment.

- [ ] **Step 3: Implement form-level aggregation and rows**

For each enrollment, increment `enrollments` once and add its student id once. Iterate forms separately: increment `forms`, increment `refunds` for refunded forms, and only for active forms add courses, fee components and typed prepaid amount. Set `totalRefunds` to the count of refunded forms while leaving `totalRegistrations = enrollments.length`.

Change export row construction to `enrollments.flatMap(enrollment => enrollment.forms.map(form => ...))`. Map form fields directly; use `reported_on` for the `報到日期` column and add `報名表序號`. Do not fall back to enrollment billing fields when forms exist.

- [ ] **Step 4: Run targeted tests**

Run the Step 2 command. Expected: PASS.

- [ ] **Step 5: Commit statistics and export**

```powershell
git add dashboard/src/hooks/useStats.js dashboard/src/hooks/useStats.test.js dashboard/src/hooks/useStats.period.test.js dashboard/src/lib/excelExport.js dashboard/src/lib/excelExport.test.js dashboard/src/hooks/useExportHandler.test.js
git commit -m "feat: aggregate and export enrollment forms"
```

---

### Task 8: Full Regression, Migration and Manual Scenario Verification

**Files:**

- Modify only if a verification command exposes a defect in files already listed above.

- [ ] **Step 1: Run all dashboard tests**

Run in `dashboard`:

```powershell
npm test -- --run
```

Expected: every Vitest test passes; no test remains written against direct enrollment-level billing mutation.

- [ ] **Step 2: Run frontend static checks**

Run in `dashboard`:

```powershell
npm run lint
npm run build
```

Expected: lint has no errors and production build succeeds. Existing warnings may remain only if they are unrelated to files changed by this plan.

- [ ] **Step 3: Rebuild and test Supabase from zero**

Run from repository root:

```powershell
npx supabase db reset --local
npx supabase test db --local supabase/tests/database
npx supabase db lint --local --schema public,private --level warning --fail-on error
npx supabase db advisors --local --type all --level info --fail-on error
```

Expected: reset and all  database tests pass; lint/advisors have no errors; no new foreign-key index warning appears. Confirm the previously stale `private.migrate_legacy_billing_receipts` lint error is gone.

- [ ] **Step 4: Verify the exact business case**

Using the UI against local Supabase:

1. Create one student and 第16期 form 1 with courses A/B, P-1/F-1, handler/date/note.
2. Add 第16期 again and accept the `第 2 張報名表` notice.
3. Save courses C/D, P-2/F-2 and different handler/date/note.
4. Reopen history and confirm one period row, two form cards and four courses.
5. Refund only form 2 and confirm form 1 remains normal; revenue and course counts retain only A/B.
6. Export and confirm two rows preserve both paper forms.

- [ ] **Step 5: Check the final diff and commit any verification fixes**

```powershell
git diff --check
git status --short
```

If Step 1-4 required fixes, stage only the affected files and commit:

```powershell
git commit -m "fix: complete enrollment form batch integration"
```

If no fixes were required, do not create an empty commit.
