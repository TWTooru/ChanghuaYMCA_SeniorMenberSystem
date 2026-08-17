# 初次報名自動建立繳費紀錄 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在「新增會員與第一筆報名」RPC 中，自動將行政人員填寫的預繳與正式費用資料建立為 `billing_receipts` 收據紀錄，使繳費明細在歷年選課歷程和帳單明細中可見。

**Architecture:** 新增一個 Supabase migration：移除 `billing_receipt_courses.course_id` 的獨立 UNIQUE 約束以允許一門課關聯多張收據，並在 `create_student_with_initial_enrollment` RPC 中於建立課程後原子建立至多兩筆收據。前端修改 `normalizeEnrollmentBilling` 以迭代所有 `billing_receipt_courses` 連結而非只取第一筆。

**Tech Stack:** PostgreSQL (Supabase), pgTAP, React 19, Vitest 4

## Global Constraints

- 不新增任何 npm 依賴
- `enrollments` 資料表上的原始欄位（`prepaid_amount`, `tuition_fee` 等）仍完整保留
- 既有的 `create_billing_receipt` RPC（手動新增收據）維持其 `PAYMENT_ALREADY_EXISTS` 應用層檢查，不受影響
- 既有的 `create_enrollment_with_courses` RPC（一般新增報名）不做修改
- 前端測試指令：`npx vitest run`（工作目錄 `dashboard`）
- 資料庫測試指令：`npx supabase test db`（工作目錄根目錄）
- Migration 檔案命名格式：`YYYYMMDDHHMMSS_description.sql`

---

### Task 1: 資料庫 Migration — 移除 UNIQUE 約束並更新 RPC 建立收據

**Files:**
- Create: `supabase/migrations/<timestamp>_initial_enrollment_billing_receipts.sql`
- Modify: `supabase/tests/database/create_member_initial_enrollment_test.sql`

**Interfaces:**
- Consumes: 現有 `create_student_with_initial_enrollment(jsonb, jsonb)` RPC 簽名（不變）
- Produces: RPC 回傳值不變（`{ student_id, enrollment_id }`），但副作用新增至多 2 筆 `billing_receipts` 與對應 `billing_receipt_courses` 關聯

- [ ] **Step 1: 建立 migration SQL 檔案**

建立 `supabase/migrations/20260817130000_initial_enrollment_billing_receipts.sql`：

```sql
begin;

-- 1. 移除 billing_receipt_courses.course_id 的獨立 UNIQUE 約束，
--    以允許初次報名的課程同時關聯至預繳與正式費用兩張收據。
--    複合主鍵 (receipt_id, course_id) 仍然有效，防止同一張收據重複關聯同一門課。
alter table public.billing_receipt_courses
  drop constraint billing_receipt_courses_course_id_key;

-- 2. 替換 create_student_with_initial_enrollment，在建立課程後原子建立收據。
create or replace function public.create_student_with_initial_enrollment(
  p_student jsonb,
  p_enrollment jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  actor_user_id uuid;
  actor_account text;
  supplied_student_id_text text;
  new_student_id bigint;
  new_enrollment_id bigint;
  birth_date_value date;
  start_date_text text;
  end_date_text text;
  handled_on_text text;
  start_date_value date;
  end_date_value date;
  handled_on_value date;
  normalized_period text;
  normalized_courses text[];
  v_prepaid_amount integer;
  v_tuition integer;
  v_materials integer;
  v_membership integer;
  v_formal_amount integer;
  v_prepaid_receipt_number text;
  v_fee_receipt_number text;
  v_receipt_id bigint;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'INITIAL_ENROLLMENT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;

  actor_user_id := (select auth.uid());
  actor_account := pg_catalog.lower(nullif(pg_catalog.btrim(auth.jwt() ->> 'email'), ''));
  if actor_user_id is null or actor_account is null then
    raise exception 'AUTH_ACCOUNT_REQUIRED' using errcode = '42501';
  end if;

  if p_student is null or pg_catalog.jsonb_typeof(p_student) <> 'object'
     or p_enrollment is null or pg_catalog.jsonb_typeof(p_enrollment) <> 'object' then
    raise exception 'INVALID_INITIAL_ENROLLMENT_PAYLOAD';
  end if;

  normalized_period := pg_catalog.btrim(p_enrollment ->> 'period');
  if normalized_period is null or normalized_period !~ '^第[1-9][0-9]*期$' then
    raise exception 'PERIOD_INVALID';
  end if;

  start_date_text := nullif(pg_catalog.btrim(p_enrollment ->> 'period_start_date'), '');
  end_date_text := nullif(pg_catalog.btrim(p_enrollment ->> 'period_end_date'), '');
  if start_date_text is null or end_date_text is null then
    raise exception 'PERIOD_DATES_REQUIRED';
  end if;
  if start_date_text !~ '^\d{4}-\d{2}-\d{2}$'
     or end_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'PERIOD_DATE_INVALID';
  end if;
  begin
    start_date_value := start_date_text::date;
    end_date_value := end_date_text::date;
  exception when others then
    raise exception 'PERIOD_DATE_INVALID';
  end;
  if pg_catalog.to_char(start_date_value, 'YYYY-MM-DD') <> start_date_text
     or pg_catalog.to_char(end_date_value, 'YYYY-MM-DD') <> end_date_text then
    raise exception 'PERIOD_DATE_INVALID';
  end if;
  if end_date_value < start_date_value then
    raise exception 'PERIOD_DATE_ORDER_INVALID';
  end if;

  if pg_catalog.jsonb_typeof(p_enrollment -> 'courses') is distinct from 'array' then
    raise exception 'COURSE_REQUIRED';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
       or nullif(pg_catalog.btrim(item.value #>> '{}'), '') is null
  ) then
    raise exception 'COURSE_REQUIRED';
  end if;
  select pg_catalog.array_agg(course_name order by course_name)
  into normalized_courses
  from (
    select min(pg_catalog.btrim(item.value #>> '{}')) course_name
    from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    group by pg_catalog.lower(pg_catalog.btrim(item.value #>> '{}'))
  ) normalized;
  if coalesce(pg_catalog.cardinality(normalized_courses), 0) = 0 then
    raise exception 'COURSE_REQUIRED';
  end if;

  handled_on_text := nullif(pg_catalog.btrim(p_enrollment ->> 'handled_on'), '');
  if handled_on_text is not null then
    if handled_on_text !~ '^\d{4}-\d{2}-\d{2}$' then
      raise exception 'HANDLED_ON_INVALID';
    end if;
    begin
      handled_on_value := handled_on_text::date;
    exception when others then
      raise exception 'HANDLED_ON_INVALID';
    end;
    if pg_catalog.to_char(handled_on_value, 'YYYY-MM-DD') <> handled_on_text then
      raise exception 'HANDLED_ON_INVALID';
    end if;
  end if;

  begin
    birth_date_value := nullif(pg_catalog.btrim(p_student ->> 'birth_date'), '')::date;
  exception when others then
    raise exception 'INVALID_BIRTH_DATE';
  end;

  -- 解析費用欄位
  v_prepaid_amount := private.optional_nonnegative_integer(p_enrollment, 'prepaid_amount');
  v_tuition := private.optional_nonnegative_integer(p_enrollment, 'tuition_fee');
  v_materials := private.optional_nonnegative_integer(p_enrollment, 'materials_fee');
  v_membership := private.optional_nonnegative_integer(p_enrollment, 'membership_fee');
  v_formal_amount := coalesce(v_tuition, 0) + coalesce(v_materials, 0) + coalesce(v_membership, 0);
  v_prepaid_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'prepaid_receipt_number'), '');
  v_fee_receipt_number := nullif(pg_catalog.btrim(p_enrollment ->> 'fee_receipt_number'), '');

  -- 建立學員
  supplied_student_id_text := nullif(pg_catalog.btrim(p_student ->> 'student_id'), '');
  if supplied_student_id_text is null then
    insert into public.students (
      email, name, gender, phone, birth_date, address, organization, education
    ) values (
      nullif(pg_catalog.btrim(p_student ->> 'email'), ''),
      pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'),
      nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value,
      nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''),
      pg_catalog.btrim(p_student ->> 'education')
    ) returning student_id into new_student_id;
  else
    begin
      new_student_id := supplied_student_id_text::bigint;
    exception when others then
      raise exception 'INVALID_STUDENT_ID';
    end;
    if new_student_id <= 0 then
      raise exception 'INVALID_STUDENT_ID';
    end if;
    insert into public.students (
      student_id, email, name, gender, phone, birth_date, address, organization, education
    ) values (
      new_student_id,
      nullif(pg_catalog.btrim(p_student ->> 'email'), ''),
      pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'),
      nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value,
      nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''),
      pg_catalog.btrim(p_student ->> 'education')
    );
  end if;

  -- 建立報名紀錄
  insert into public.enrollments (
    student_id, period, reg_type, refunded, refund_info,
    period_start_date, period_end_date, notes,
    prepaid_amount, prepaid_receipt_number,
    tuition_fee, materials_fee, membership_fee, fee_receipt_number,
    handled_by_name, handled_by_user_id, handled_by_account, handled_on
  ) values (
    new_student_id, normalized_period, '一般', 0, null,
    start_date_value, end_date_value, nullif(pg_catalog.btrim(p_enrollment ->> 'notes'), ''),
    v_prepaid_amount, v_prepaid_receipt_number,
    v_tuition, v_materials, v_membership, v_fee_receipt_number,
    nullif(pg_catalog.btrim(p_enrollment ->> 'handled_by_name'), ''),
    actor_user_id, actor_account, handled_on_value
  ) returning enrollment_id into new_enrollment_id;

  -- 建立課程明細
  insert into public.courses (enrollment_id, course_name)
  select new_enrollment_id, course_name
  from pg_catalog.unnest(normalized_courses) selected(course_name);

  -- 自動建立預繳收據
  if coalesce(v_prepaid_amount, 0) > 0 then
    insert into public.billing_receipts (amount, invoice_number)
    values (v_prepaid_amount, v_prepaid_receipt_number)
    returning receipt_id into v_receipt_id;

    insert into public.billing_receipt_courses (receipt_id, course_id)
    select v_receipt_id, c.course_id
    from public.courses c
    where c.enrollment_id = new_enrollment_id;
  end if;

  -- 自動建立正式費用收據
  if v_formal_amount > 0 then
    insert into public.billing_receipts (amount, invoice_number)
    values (v_formal_amount, v_fee_receipt_number)
    returning receipt_id into v_receipt_id;

    insert into public.billing_receipt_courses (receipt_id, course_id)
    select v_receipt_id, c.course_id
    from public.courses c
    where c.enrollment_id = new_enrollment_id;
  end if;

  return pg_catalog.jsonb_build_object(
    'student_id', new_student_id,
    'enrollment_id', new_enrollment_id
  );
end
$function$;

revoke all on function public.create_student_with_initial_enrollment(jsonb, jsonb)
from public, anon, authenticated;
grant execute on function public.create_student_with_initial_enrollment(jsonb, jsonb)
to authenticated;

commit;
```

- [ ] **Step 2: 更新 pgTAP 測試**

在 `supabase/tests/database/create_member_initial_enrollment_test.sql` 中：

**2a. 更新 `select plan(N)` 行數**：從 `plan(26)` 改為 `plan(31)`（新增 5 個斷言）。

**2b. 在現有主要測試（`test.created` 設定之後、`viewer` 測試之前）新增收據驗證**：

```sql
-- 驗證自動建立的繳費收據
select is(
  (select count(*)::integer from public.billing_receipts br
   join public.billing_receipt_courses brc on brc.receipt_id = br.receipt_id
   join public.courses c on c.course_id = brc.course_id
   where c.enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  4,
  'initial enrollment creates 4 receipt-course links (2 courses x 2 receipts)'
);

select is(
  (select count(distinct br.receipt_id)::integer from public.billing_receipts br
   join public.billing_receipt_courses brc on brc.receipt_id = br.receipt_id
   join public.courses c on c.course_id = brc.course_id
   where c.enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  2,
  'initial enrollment creates exactly 2 distinct billing receipts'
);

select is(
  (select pg_catalog.jsonb_build_object('amount', br.amount, 'invoice', br.invoice_number)
   from public.billing_receipts br
   join public.billing_receipt_courses brc on brc.receipt_id = br.receipt_id
   join public.courses c on c.course_id = brc.course_id
   where c.enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint
     and br.amount = 500
   limit 1),
  '{"amount": 500, "invoice": "P-1"}'::jsonb,
  'prepaid receipt has correct amount and invoice number'
);

select is(
  (select pg_catalog.jsonb_build_object('amount', br.amount, 'invoice', br.invoice_number)
   from public.billing_receipts br
   join public.billing_receipt_courses brc on brc.receipt_id = br.receipt_id
   join public.courses c on c.course_id = brc.course_id
   where c.enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint
     and br.amount = 2800
   limit 1),
  '{"amount": 2800, "invoice": "F-1"}'::jsonb,
  'formal fee receipt has correct amount (2400+300+100) and invoice number'
);
```

**2c. 新增零金額測試**（在 validation 測試與 `historical enrollments` 測試之間）：

```sql
select pg_catalog.set_config(
  'test.zero_fees',
  public.create_student_with_initial_enrollment(
    '{"name":"零費用會員","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第8期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["瑜伽入門"]}'::jsonb
  )::text,
  true
);

select is(
  (select count(*)::integer from public.billing_receipts br
   join public.billing_receipt_courses brc on brc.receipt_id = br.receipt_id
   join public.courses c on c.course_id = brc.course_id
   where c.enrollment_id = (pg_catalog.current_setting('test.zero_fees')::jsonb ->> 'enrollment_id')::bigint),
  0,
  'no billing receipts when all fees are null or zero'
);
```

- [ ] **Step 3: 執行 migration 與 pgTAP 測試**

Run: `npx supabase db reset`
Working directory: root
Expected: Migration 成功套用

Run: `npx supabase test db`
Working directory: root
Expected: 所有 31 個測試 PASS

- [ ] **Step 4: Commit**

```
git add supabase/migrations/20260817130000_initial_enrollment_billing_receipts.sql supabase/tests/database/create_member_initial_enrollment_test.sql
git commit -m "feat(db): auto-create billing receipts on initial enrollment, drop course_id unique"
```

---

### Task 2: 前端 — 更新 `normalizeEnrollmentBilling` 支援多收據解析

**Files:**
- Modify: `dashboard/src/domain/enrollmentBilling.js`
- Modify: `dashboard/src/domain/enrollmentBilling.test.js`

**Interfaces:**
- Consumes: Supabase query 回傳的 `course.billing_receipt_courses` 陣列——原先每門課最多 1 筆，現在可能有多筆（預繳 + 正式費用）
- Produces: `normalizeEnrollmentBilling` 回傳的 `{ courseDetails, billingReceipts }` 結構不變，但 `billingReceipts` 陣列現在能正確包含多張收據

- [ ] **Step 1: 撰寫失敗的測試**

在 `dashboard/src/domain/enrollmentBilling.test.js` 的 `describe('normalizeEnrollmentBilling')` 區塊中加入新的測試案例：

```javascript
  it('collects multiple receipts when a course has multiple billing_receipt_courses links', () => {
    expect(normalizeEnrollmentBilling([
      {
        course_id: 20,
        course_name: '瑜珈課',
        billing_receipt_courses: [
          {
            billing_receipts: { receipt_id: 200, amount: 500, invoice_number: 'P-1' },
          },
          {
            billing_receipts: { receipt_id: 201, amount: 2800, invoice_number: 'F-1' },
          },
        ],
      },
      {
        course_id: 21,
        course_name: '手機課',
        billing_receipt_courses: [
          {
            billing_receipts: { receipt_id: 200, amount: 500, invoice_number: 'P-1' },
          },
          {
            billing_receipts: { receipt_id: 201, amount: 2800, invoice_number: 'F-1' },
          },
        ],
      },
    ])).toEqual({
      courseDetails: [
        {
          courseId: 20,
          courseName: '瑜珈課',
          billingReceiptId: 200,
          receipt: { receiptId: 200, amount: 500, invoiceNumber: 'P-1' },
        },
        {
          courseId: 21,
          courseName: '手機課',
          billingReceiptId: 200,
          receipt: { receiptId: 200, amount: 500, invoiceNumber: 'P-1' },
        },
      ],
      billingReceipts: [
        {
          receiptId: 200,
          amount: 500,
          invoiceNumber: 'P-1',
          courses: [
            { courseId: 20, courseName: '瑜珈課' },
            { courseId: 21, courseName: '手機課' },
          ],
        },
        {
          receiptId: 201,
          amount: 2800,
          invoiceNumber: 'F-1',
          courses: [
            { courseId: 20, courseName: '瑜珈課' },
            { courseId: 21, courseName: '手機課' },
          ],
        },
      ],
    })
  })
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npx vitest run src/domain/enrollmentBilling.test.js`
Working directory: `dashboard`
Expected: FAIL — 新增的測試案例失敗，因為 `normalizeEnrollmentBilling` 只取 `firstReceipt` 導致第二張收據被遺漏

- [ ] **Step 3: 實作 `normalizeEnrollmentBilling` 修改**

修改 `dashboard/src/domain/enrollmentBilling.js` 中的 `normalizeEnrollmentBilling` 函式：

```javascript
export function normalizeEnrollmentBilling(courseRows = []) {
  const receiptMap = new Map()
  const courseDetails = courseRows.map(course => {
    const links = Array.isArray(course.billing_receipt_courses)
      ? course.billing_receipt_courses
      : course.billing_receipt_courses ? [course.billing_receipt_courses] : []

    let firstReceiptId = null
    let firstReceiptData = null

    for (const link of links) {
      const receipt = firstReceipt(link?.billing_receipts)
      if (!receipt) continue

      if (firstReceiptId === null) {
        firstReceiptId = receipt.receipt_id
        firstReceiptData = {
          receiptId: receipt.receipt_id,
          amount: receipt.amount,
          invoiceNumber: receipt.invoice_number,
        }
      }

      const normalizedReceipt = receiptMap.get(receipt.receipt_id) || {
        receiptId: receipt.receipt_id,
        amount: receipt.amount,
        invoiceNumber: receipt.invoice_number,
        courses: [],
      }
      if (!normalizedReceipt.courses.some(c => c.courseId === course.course_id)) {
        normalizedReceipt.courses.push({
          courseId: course.course_id,
          courseName: course.course_name,
        })
      }
      receiptMap.set(receipt.receipt_id, normalizedReceipt)
    }

    return {
      courseId: course.course_id,
      courseName: course.course_name,
      billingReceiptId: firstReceiptId,
      receipt: firstReceiptData,
    }
  })

  return { courseDetails, billingReceipts: [...receiptMap.values()] }
}
```

此修改將原先的 `firstReceipt(course.billing_receipt_courses)` 單筆取值替換為遍歷所有 `links`。`courseDetail` 仍保留第一筆收據的 `billingReceiptId` 與 `receipt`（用於判斷該課程是否已有收據），而 `receiptMap` 則收集所有不重複的收據。

- [ ] **Step 4: 執行測試確認通過**

Run: `npx vitest run src/domain/enrollmentBilling.test.js`
Working directory: `dashboard`
Expected: 所有測試 PASS（含既有測試和新增的多收據測試）

- [ ] **Step 5: 執行完整前端測試確認無回歸**

Run: `npx vitest run`
Working directory: `dashboard`
Expected: 所有測試 PASS

- [ ] **Step 6: Commit**

```
git add dashboard/src/domain/enrollmentBilling.js dashboard/src/domain/enrollmentBilling.test.js
git commit -m "feat: support multiple billing receipts per course in normalizeEnrollmentBilling"
```
