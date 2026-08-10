# 選課繳費紀錄架構修正 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓同一季度的一筆繳費可涵蓋一至多門課，並在新增選課時原子建立可選填的繳費紀錄，同時修正 RPC 權限、重複送出與 modal 無障礙問題。

**Architecture:** 以 `billing_receipts` 作繳費主檔、`billing_receipt_courses` 作課程關聯，所有寫入透過角色檢查完整的原子 RPC。前端以純 domain 模組正規化 payment-record drafts，由共用 editor 管理輸入，dashboard read model 將 Supabase 巢狀資料轉成不重複的 `billingReceipts`；舊 `course_receipts` 先透過相容橋接保留，正式資料驗證後才另案移除。

**Tech Stack:** PostgreSQL 15 / Supabase migrations and pgTAP · React 19 · Supabase JS 2 · Vitest 4 · React Testing Library · Vite 8 · oxlint

## Global Constraints

- 設計依據：`docs/superpowers/specs/2026-08-10-enrollment-payment-records-design.md`。
- 執行前使用 `superpowers:using-git-worktrees` 建立隔離工作區；若執行環境禁止 worktree，先記錄並保留所有既有未提交差異。
- `dashboard/src/components/enrollment/CourseTagPicker.jsx` 與 `dashboard/src/services/dashboardDataService.js` 目前已有使用者修改；編輯前分別執行 `git diff -- dashboard/src/components/enrollment/CourseTagPicker.jsx` 與 `git diff -- dashboard/src/services/dashboardDataService.js`，只合併本計畫需要的區塊，不覆寫其他內容。
- 不新增 npm 套件，不更換 React、Supabase、Vitest 或 Vite 版本。
- 使用者介面一律稱為「繳費紀錄」；資料庫物件使用 `billing_receipt*`。
- 新建立或修改的繳費紀錄金額必填，且只能是 0 或正整數；發票編號選填。
- 遷移前已存在的 null 金額收據必須可讀，但不得透過新 UI 新增或儲存 null 金額。
- 同一筆繳費只能包含同一 enrollment 的課程；同一門課最多隸屬一筆繳費。
- viewer 只讀，editor/admin 可寫；UI 權限不是安全邊界，所有 mutation RPC 都要檢查 `public.current_app_role()`。
- mutation RPC 使用 `security definer set search_path = ''`、完整限定資料庫物件名稱、撤銷 public/anon execute，再只授權 authenticated 呼叫；函式內依 JWT 應用角色拒絕 viewer。
- 新增 enrollment、courses、初始繳費主檔與課程關聯必須在同一 PostgreSQL 交易中完成。
- 本次 release 不 drop 舊 `course_receipts`；migration 建立 old-to-new 同步橋接。移除舊表是正式回填驗證後的獨立 follow-up release。
- 每個 task 只 stage 該 task 明列的檔案；不得使用 `git add .`。

---

### Task 1: 建立繳費草稿的純 domain 契約

**Files:**
- Create: `dashboard/src/domain/enrollmentPayments.js`
- Create: `dashboard/src/domain/enrollmentPayments.test.js`

**Interfaces:**
- Consumes: `{ courseNames, amount, invoiceNumber }[]` 與已選課程名稱陣列。
- Produces: `normalizePaymentAmount(value) -> number`、`normalizePaymentRecords(records, selectedCourseNames) -> { course_names, amount, invoice_number }[]`、`reconcilePaymentRecords(records, selectedCourseNames) -> records`。
- Error contract: `繳費紀錄必須至少選擇一門課程`、`金額必須為 0 或正整數`、`繳費紀錄包含未選擇的課程`、`同一門課不能出現在多筆繳費紀錄`。

- [ ] **Step 1: 寫出 domain RED tests**

建立 `dashboard/src/domain/enrollmentPayments.test.js`：

```js
import { describe, expect, it } from 'vitest'
import {
  normalizePaymentAmount,
  normalizePaymentRecords,
  reconcilePaymentRecords,
} from './enrollmentPayments'

describe('normalizePaymentAmount', () => {
  it.each([
    ['0', 0],
    ['1200', 1200],
    [' 3000 ', 3000],
  ])('normalizes %p', (input, expected) => {
    expect(normalizePaymentAmount(input)).toBe(expected)
  })

  it.each(['', ' ', '-1', '1.5', 'abc', '2147483648', '9007199254740992'])(
    'rejects invalid amount %p',
    input => expect(() => normalizePaymentAmount(input)).toThrow('金額必須為 0 或正整數'),
  )
})

describe('normalizePaymentRecords', () => {
  it('normalizes a single-course and a multi-course payment', () => {
    expect(normalizePaymentRecords([
      { localId: 'p1', courseNames: ['A'], amount: '1000', invoiceNumber: ' A001 ' },
      { localId: 'p2', courseNames: ['B', 'C'], amount: '2000', invoiceNumber: ' ' },
    ], ['A', 'B', 'C'])).toEqual([
      { course_names: ['A'], amount: 1000, invoice_number: 'A001' },
      { course_names: ['B', 'C'], amount: 2000, invoice_number: null },
    ])
  })

  it('accepts no payment records', () => {
    expect(normalizePaymentRecords([], ['A'])).toEqual([])
  })

  it('rejects an empty course assignment', () => {
    expect(() => normalizePaymentRecords([
      { localId: 'p1', courseNames: [], amount: '1000', invoiceNumber: '' },
    ], ['A'])).toThrow('繳費紀錄必須至少選擇一門課程')
  })

  it('rejects an unselected or duplicate course assignment', () => {
    expect(() => normalizePaymentRecords([
      { localId: 'p1', courseNames: ['B'], amount: '1000', invoiceNumber: '' },
    ], ['A'])).toThrow('繳費紀錄包含未選擇的課程')

    expect(() => normalizePaymentRecords([
      { localId: 'p1', courseNames: ['A'], amount: '1000', invoiceNumber: '' },
      { localId: 'p2', courseNames: ['A'], amount: '2000', invoiceNumber: '' },
    ], ['A'])).toThrow('同一門課不能出現在多筆繳費紀錄')
  })
})

describe('reconcilePaymentRecords', () => {
  it('removes deselected courses and drops empty records', () => {
    expect(reconcilePaymentRecords([
      { localId: 'p1', courseNames: ['A', 'B'], amount: '1000', invoiceNumber: 'A001' },
      { localId: 'p2', courseNames: ['C'], amount: '2000', invoiceNumber: '' },
    ], ['A', 'C'])).toEqual([
      { localId: 'p1', courseNames: ['A'], amount: '1000', invoiceNumber: 'A001' },
      { localId: 'p2', courseNames: ['C'], amount: '2000', invoiceNumber: '' },
    ])

    expect(reconcilePaymentRecords([
      { localId: 'p1', courseNames: ['B'], amount: '1000', invoiceNumber: '' },
    ], ['A'])).toEqual([])
  })
})
```

- [ ] **Step 2: 執行 RED test**

Run from `dashboard/`:

```powershell
npm test -- src/domain/enrollmentPayments.test.js
```

Expected: FAIL，訊息包含 `Failed to resolve import "./enrollmentPayments"`。

- [ ] **Step 3: 實作最小 domain 模組**

建立 `dashboard/src/domain/enrollmentPayments.js`，使用以下確切規則：

```js
const PAYMENT_AMOUNT_ERROR = '金額必須為 0 或正整數'
const POSTGRES_INTEGER_MAX = 2147483647

export function normalizePaymentAmount(value) {
  const text = String(value ?? '').trim()
  if (!/^\d+$/.test(text)) throw new Error(PAYMENT_AMOUNT_ERROR)

  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount > POSTGRES_INTEGER_MAX) {
    throw new Error(PAYMENT_AMOUNT_ERROR)
  }
  return amount
}

export function normalizePaymentRecords(records = [], selectedCourseNames = []) {
  const selected = new Set(selectedCourseNames)
  const assigned = new Set()

  return records.map(record => {
    const courseNames = [...new Set((record.courseNames || []).map(String))]
    if (courseNames.length === 0) throw new Error('繳費紀錄必須至少選擇一門課程')

    for (const courseName of courseNames) {
      if (!selected.has(courseName)) throw new Error('繳費紀錄包含未選擇的課程')
      if (assigned.has(courseName)) throw new Error('同一門課不能出現在多筆繳費紀錄')
      assigned.add(courseName)
    }

    return {
      course_names: courseNames,
      amount: normalizePaymentAmount(record.amount),
      invoice_number: String(record.invoiceNumber ?? '').trim() || null,
    }
  })
}

export function reconcilePaymentRecords(records = [], selectedCourseNames = []) {
  const selected = new Set(selectedCourseNames)
  return records
    .map(record => ({
      ...record,
      courseNames: (record.courseNames || []).filter(courseName => selected.has(courseName)),
    }))
    .filter(record => record.courseNames.length > 0)
}
```

- [ ] **Step 4: 執行 GREEN test**

Run:

```powershell
npm test -- src/domain/enrollmentPayments.test.js
```

Expected: PASS，所有 domain cases 通過。

- [ ] **Step 5: Commit**

```powershell
git add -- dashboard/src/domain/enrollmentPayments.js dashboard/src/domain/enrollmentPayments.test.js
git commit -m "feat(billing): add payment record domain rules"
```

---

### Task 2: 建立 grouped billing schema、回填橋接與安全 RPC

**Files:**
- Create: `supabase/migrations/20260810120000_grouped_billing_receipts.sql`
- Create: `supabase/tests/database/billing_receipts_test.sql`
- Modify: `supabase/tests/database/enrollment_billing_fields_test.sql`

**Interfaces:**
- Consumes: `p_payment_records jsonb`，每列為 `{ "course_names": text[], "amount": integer, "invoice_number": text|null }`。
- Produces: `public.create_enrollment_with_courses(text, text, text, text, text, integer, text, text[], jsonb) returns text`。
- Produces: `public.create_billing_receipt(p_course_ids bigint[], p_amount integer, p_invoice_number text) returns jsonb`。
- Produces: `public.update_billing_receipt(p_receipt_id bigint, p_amount integer, p_invoice_number text) returns jsonb`。
- Produces: `public.delete_billing_receipt(p_receipt_id bigint) returns void`。
- Preserves: `public.update_enrollment_with_courses(text, text, text, text, text, integer, text, text[])`，但 billed-course lock 改查 `billing_receipt_courses`。
- Error codes/messages: `ENROLLMENT_CREATE_FORBIDDEN`, `COURSE_REQUIRED`, `SEASON_REQUIRED`, `STUDENT_NOT_FOUND`, `ENROLLMENT_ALREADY_EXISTS`, `PAYMENT_RECORDS_INVALID`, `PAYMENT_FORBIDDEN`, `PAYMENT_COURSE_REQUIRED`, `PAYMENT_COURSE_NOT_FOUND`, `PAYMENT_AMOUNT_REQUIRED`, `PAYMENT_AMOUNT_INVALID`, `PAYMENT_COURSE_NOT_SELECTED`, `PAYMENT_COURSE_DUPLICATE`, `PAYMENT_CROSS_ENROLLMENT`, `PAYMENT_ALREADY_EXISTS`, `PAYMENT_NOT_FOUND`。

- [ ] **Step 1: 建立 pgTAP RED tests**

建立 `supabase/tests/database/billing_receipts_test.sql`，以 transaction 包住 fixtures：

```sql
begin;
select no_plan();

select has_table('public', 'billing_receipts', 'billing receipt headers exist');
select has_table('public', 'billing_receipt_courses', 'billing receipt course links exist');
select col_type_is('public', 'billing_receipts', 'amount', 'integer', 'billing amount is integer');
select col_is_null('public', 'billing_receipts', 'amount', 'legacy null amount remains representable');
select col_is_unique('public', 'billing_receipt_courses', 'course_id', 'one course belongs to at most one receipt');
select has_function('public', 'create_billing_receipt', array['bigint[]', 'integer', 'text'], 'create receipt RPC exists');
select has_function('public', 'update_billing_receipt', array['bigint', 'integer', 'text'], 'update receipt RPC exists');
select has_function('public', 'delete_billing_receipt', array['bigint'], 'delete receipt RPC exists');
```

在同檔的 schema assertions 後加入以下 fixtures 與 `lives_ok` / `throws_ok`：

```sql
select set_config('test.payment_student_id', (910000000000 + txid_current())::text, true);
insert into public.students (student_id, name)
values (current_setting('test.payment_student_id'), 'Payment test student');

with inserted as (
  insert into public.enrollments (student_id, season)
  values (current_setting('test.payment_student_id'), 'Payment Test Season A')
  returning enrollment_id
)
select set_config('test.payment_enrollment_a', enrollment_id::text, true)
from inserted;

with inserted as (
  insert into public.enrollments (student_id, season)
  values (current_setting('test.payment_student_id'), 'Payment Test Season B')
  returning enrollment_id
)
select set_config('test.payment_enrollment_b', enrollment_id::text, true)
from inserted;

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, names.course_name
from public.enrollments e
cross join (values ('A'), ('B')) as names(course_name)
where e.enrollment_id::text = current_setting('test.payment_enrollment_a');

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, 'C'
from public.enrollments e
where e.enrollment_id::text = current_setting('test.payment_enrollment_b');

select set_config(
  'test.payment_course_a',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_a') and c.course_name = 'A'),
  true
);
select set_config(
  'test.payment_course_b',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_a') and c.course_name = 'B'),
  true
);
select set_config(
  'test.payment_course_c',
  (select c.course_id::text from public.courses c
   where c.enrollment_id::text = current_setting('test.payment_enrollment_b') and c.course_name = 'C'),
  true
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"editor"}}',
  true
);

select lives_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s,%s]::bigint[], 3000, %L)',
    current_setting('test.payment_course_a'),
    current_setting('test.payment_course_b'),
    'R-1'
  ),
  'editor creates one receipt for two courses in one enrollment'
);

select set_config(
  'test.payment_receipt_id',
  (select link.receipt_id::text
   from public.billing_receipt_courses link
   where link.course_id = current_setting('test.payment_course_a')::bigint),
  true
);

select results_eq(
  pg_catalog.format(
    'select count(*)::integer from public.billing_receipt_courses where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (2::integer)$$,
  'one receipt owns both course links'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_a')
  ),
  'P0001',
  'PAYMENT_ALREADY_EXISTS',
  'the same course cannot be billed twice'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s,%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_b'),
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_CROSS_ENROLLMENT',
  'one receipt cannot cross enrollments'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], null, null)',
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_AMOUNT_REQUIRED',
  'new receipts require an amount'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], -1, null)',
    current_setting('test.payment_course_c')
  ),
  'P0001',
  'PAYMENT_AMOUNT_INVALID',
  'new receipts reject negative amounts'
);

select lives_ok(
  pg_catalog.format(
    'select public.update_billing_receipt(%s, 3200, %L)',
    current_setting('test.payment_receipt_id'),
    'R-UPDATED'
  ),
  'editor updates only receipt billing fields'
);

select results_eq(
  pg_catalog.format(
    'select amount, invoice_number from public.billing_receipts where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (3200::integer, 'R-UPDATED'::text)$$,
  'updated billing fields are stored once on the header'
);

select throws_ok(
  pg_catalog.format(
    'select public.update_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[])',
    current_setting('test.payment_enrollment_a'),
    'Payment Test Season A',
    '續',
    '',
    '',
    0,
    '',
    'A'
  ),
  'P0001',
  'COURSE_RECEIPT_LOCKED',
  'an enrollment update cannot remove a course owned by a grouped receipt'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"viewer"}}',
  true
);

select throws_ok(
  pg_catalog.format(
    'select public.create_billing_receipt(array[%s]::bigint[], 1000, null)',
    current_setting('test.payment_course_c')
  ),
  '42501',
  'PAYMENT_FORBIDDEN',
  'viewer cannot create a receipt'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Viewer Forbidden Season',
    '續',
    '',
    '',
    0,
    '',
    'Viewer Course',
    '[]'
  ),
  '42501',
  'ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot create an enrollment through RPC'
);

select set_config(
  'request.jwt.claims',
  '{"app_metadata":{"app_role":"editor"}}',
  true
);

select set_config(
  'test.payment_enrollment_count_before',
  (select count(*)::text from public.enrollments
   where student_id = current_setting('test.payment_student_id')),
  true
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Duplicate Payment Assignment',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["X"],"amount":1000},{"course_names":["X"],"amount":2000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_DUPLICATE',
  'one course cannot appear in two initial payments'
);

select is(
  (select count(*)::text from public.enrollments
   where student_id = current_setting('test.payment_student_id')),
  current_setting('test.payment_enrollment_count_before'),
  'duplicate payment validation happens before enrollment insert'
);

select throws_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Unselected Payment Course',
    '續',
    '',
    '',
    0,
    '',
    'X',
    '[{"course_names":["Y"],"amount":1000}]'
  ),
  'P0001',
  'PAYMENT_COURSE_NOT_SELECTED',
  'initial payment cannot reference an unselected course'
);

select lives_ok(
  pg_catalog.format(
    'select public.create_enrollment_with_courses(%L,%L,%L,%L,%L,%s,%L,array[%L,%L]::text[],%L::jsonb)',
    current_setting('test.payment_student_id'),
    'Atomic Grouped Payment',
    '續',
    '',
    '',
    0,
    '',
    'D',
    'E',
    '[{"course_names":["D","E"],"amount":4000,"invoice_number":"R-ATOMIC"}]'
  ),
  'editor atomically creates enrollment, courses, receipt, and links'
);

select results_eq(
  $$select count(*)::integer
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Atomic Grouped Payment'
      and receipt.invoice_number = 'R-ATOMIC'$$,
  $$values (2::integer)$$,
  'atomic initial payment owns both newly inserted courses'
);

insert into public.courses (enrollment_id, course_name)
select e.enrollment_id, 'Legacy Null Amount'
from public.enrollments e
where e.enrollment_id::text = current_setting('test.payment_enrollment_b');

insert into public.course_receipts (course_id, amount, invoice_number)
select c.course_id, null, 'LEGACY-NULL'
from public.courses c
where c.enrollment_id::text = current_setting('test.payment_enrollment_b')
  and c.course_name = 'Legacy Null Amount';

select results_eq(
  $$select receipt.amount, receipt.invoice_number
    from public.course_receipts old
    join public.billing_receipts receipt
      on receipt.legacy_course_receipt_id = old.receipt_id
    join public.billing_receipt_courses link
      on link.receipt_id = receipt.receipt_id and link.course_id = old.course_id
    where old.invoice_number = 'LEGACY-NULL'$$,
  $$values (null::integer, 'LEGACY-NULL'::text)$$,
  'legacy trigger preserves a null amount and its course link'
);

with inserted as (
  insert into public.enrollments (student_id, season, amount, invoice_number)
  values (current_setting('test.payment_student_id'), 'Legacy Enrollment Billing', 5000, 'LEGACY-ALL')
  returning enrollment_id
)
insert into public.courses (enrollment_id, course_name)
select inserted.enrollment_id, names.course_name
from inserted
cross join (values ('Legacy A'), ('Legacy B')) as names(course_name);

select private.migrate_legacy_billing_receipts();

select results_eq(
  $$select count(*)::integer
    from public.billing_receipts receipt
    join public.billing_receipt_courses link on link.receipt_id = receipt.receipt_id
    join public.courses course on course.course_id = link.course_id
    join public.enrollments enrollment on enrollment.enrollment_id = course.enrollment_id
    where enrollment.season = 'Legacy Enrollment Billing'
      and receipt.amount = 5000
      and receipt.invoice_number = 'LEGACY-ALL'$$,
  $$values (2::integer)$$,
  'legacy enrollment billing migrates to one receipt linked to all courses'
);

select results_eq(
  $$select amount, invoice_number
    from public.enrollments
    where season = 'Legacy Enrollment Billing'$$,
  $$values (null::integer, null::text)$$,
  'legacy enrollment fields clear only after successful conversion'
);

select lives_ok(
  pg_catalog.format(
    'select public.delete_billing_receipt(%s)',
    current_setting('test.payment_receipt_id')
  ),
  'editor deletes a grouped receipt'
);

select results_eq(
  pg_catalog.format(
    'select count(*)::integer from public.billing_receipt_courses where receipt_id = %s',
    current_setting('test.payment_receipt_id')
  ),
  $$values (0::integer)$$,
  'deleting a receipt cascades its course links'
);

select * from finish();
rollback;
```

修改 `supabase/tests/database/enrollment_billing_fields_test.sql`，保留舊欄位 nullable 與負數 constraint 測試，另加入一個 assertion，確認新 dashboard cutover 前舊欄位仍存在，不在本 migration drop。

- [ ] **Step 2: 執行資料庫 RED test**

Run from repository root:

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/billing_receipts_test.sql
```

Expected: FAIL，第一個 missing relation/function assertion 指向 `billing_receipts`。

- [ ] **Step 3: 建立新表與 read RLS**

在 `20260810120000_grouped_billing_receipts.sql` 先建立資料結構：

```sql
create table public.billing_receipts (
  receipt_id bigint generated by default as identity primary key,
  amount integer check (amount is null or amount >= 0),
  invoice_number text,
  legacy_course_receipt_id bigint unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.billing_receipt_courses (
  receipt_id bigint not null
    references public.billing_receipts(receipt_id) on delete cascade,
  course_id bigint not null unique
    references public.courses(course_id) on delete restrict,
  primary key (receipt_id, course_id)
);

create index billing_receipt_courses_receipt_id_idx
on public.billing_receipt_courses (receipt_id);

create trigger billing_receipts_set_updated_at
before update on public.billing_receipts
for each row execute function public.set_updated_at();

alter table public.billing_receipts enable row level security;
alter table public.billing_receipt_courses enable row level security;

create policy "role users can select billing receipts"
on public.billing_receipts for select to authenticated
using (public.current_app_role() in ('viewer', 'editor', 'admin'));

create policy "role users can select billing receipt courses"
on public.billing_receipt_courses for select to authenticated
using (public.current_app_role() in ('viewer', 'editor', 'admin'));

grant select on public.billing_receipts, public.billing_receipt_courses to authenticated;
revoke insert, update, delete on public.billing_receipts, public.billing_receipt_courses
from anon, authenticated;
```

`legacy_course_receipt_id` 只服務轉換期 old-to-new trigger；新 RPC 永遠寫入 null。

- [ ] **Step 4: 實作可重跑的歷史回填與同步橋接**

在同一 migration 的 `private` schema 建立 `private.migrate_legacy_billing_receipts()`：

```sql
create or replace function private.migrate_legacy_billing_receipts()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment record;
  v_receipt_id bigint;
begin
  insert into public.billing_receipts (
    amount,
    invoice_number,
    legacy_course_receipt_id,
    created_at,
    updated_at
  )
  select old.amount, old.invoice_number, old.receipt_id, old.created_at, old.updated_at
  from public.course_receipts old
  on conflict (legacy_course_receipt_id) do update
  set amount = excluded.amount,
      invoice_number = excluded.invoice_number,
      updated_at = excluded.updated_at;

  insert into public.billing_receipt_courses (receipt_id, course_id)
  select current_receipt.receipt_id, old.course_id
  from public.course_receipts old
  join public.billing_receipts current_receipt
    on current_receipt.legacy_course_receipt_id = old.receipt_id
  on conflict (course_id) do nothing;

  for v_enrollment in
    select e.enrollment_id::text as enrollment_id_text,
           e.amount,
           e.invoice_number
    from public.enrollments e
    where e.amount is not null
      and exists (
        select 1 from public.courses c
        where c.enrollment_id::text = e.enrollment_id::text
      )
      and not exists (
        select 1
        from public.courses c
        join public.course_receipts old on old.course_id = c.course_id
        where c.enrollment_id::text = e.enrollment_id::text
      )
      and not exists (
        select 1
        from public.courses c
        join public.billing_receipt_courses link on link.course_id = c.course_id
        where c.enrollment_id::text = e.enrollment_id::text
      )
  loop
    insert into public.billing_receipts (amount, invoice_number)
    values (v_enrollment.amount, nullif(pg_catalog.btrim(v_enrollment.invoice_number), ''))
    returning receipt_id into v_receipt_id;

    insert into public.billing_receipt_courses (receipt_id, course_id)
    select v_receipt_id, c.course_id
    from public.courses c
    where c.enrollment_id::text = v_enrollment.enrollment_id_text;

    update public.enrollments e
    set amount = null, invoice_number = null
    where e.enrollment_id::text = v_enrollment.enrollment_id_text;
  end loop;
end;
$$;

revoke all on function private.migrate_legacy_billing_receipts()
from public, anon, authenticated;

select private.migrate_legacy_billing_receipts();
```

再建立 `private.sync_legacy_course_receipt()` trigger function，使 migration 後仍由舊 dashboard 寫入的單課收據同步到新表：

```sql
create or replace function private.sync_legacy_course_receipt()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_receipt_id bigint;
  v_existing_receipt_id bigint;
begin
  if tg_op = 'DELETE' then
    delete from public.billing_receipts receipt
    where receipt.legacy_course_receipt_id = old.receipt_id;
    return old;
  end if;

  insert into public.billing_receipts (
    amount,
    invoice_number,
    legacy_course_receipt_id,
    created_at,
    updated_at
  ) values (
    new.amount,
    new.invoice_number,
    new.receipt_id,
    new.created_at,
    new.updated_at
  )
  on conflict (legacy_course_receipt_id) do update
  set amount = excluded.amount,
      invoice_number = excluded.invoice_number,
      updated_at = excluded.updated_at
  returning receipt_id into v_receipt_id;

  if tg_op = 'UPDATE' and old.course_id <> new.course_id then
    delete from public.billing_receipt_courses link
    where link.receipt_id = v_receipt_id and link.course_id = old.course_id;
  end if;

  select link.receipt_id
  into v_existing_receipt_id
  from public.billing_receipt_courses link
  where link.course_id = new.course_id;
  if v_existing_receipt_id is not null and v_existing_receipt_id <> v_receipt_id then
    raise exception 'PAYMENT_ALREADY_EXISTS';
  end if;

  insert into public.billing_receipt_courses (receipt_id, course_id)
  values (v_receipt_id, new.course_id)
  on conflict (course_id) do nothing;
  return new;
end;
$$;

revoke all on function private.sync_legacy_course_receipt()
from public, anon, authenticated;

create trigger course_receipts_sync_grouped_billing
after insert or update or delete on public.course_receipts
for each row execute function private.sync_legacy_course_receipt();
```

trigger 只掛在舊 `public.course_receipts`，新 RPC 不回寫舊表。將此橋接保留到 follow-up cleanup release。

- [ ] **Step 5: 實作 secure create-enrollment RPC**

先 drop 目前含 `p_amount` / `p_invoice_number` 的舊簽章，再建立下列固定簽章：

```sql
drop function if exists public.create_enrollment_with_courses(
  text, text, text, text, text, integer, text, integer, text, text[]
);
drop function if exists public.create_enrollment_with_courses(
  text, text, text, text, text, integer, text, text[]
);

create function public.create_enrollment_with_courses(
  p_student_id text,
  p_season text,
  p_reg_type text,
  p_pre_test text,
  p_post_test text,
  p_refunded integer,
  p_refund_info text,
  p_course_names text[],
  p_payment_records jsonb default '[]'::jsonb
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment_id public.enrollments.enrollment_id%type;
  v_payment jsonb;
  v_course_name text;
  v_course_names text[];
  v_payment_course_names text[];
  v_seen_payment_courses text[] := array[]::text[];
  v_receipt_id bigint;
  v_amount integer;
  v_amount_text text;
begin
  if public.current_app_role() not in ('editor', 'admin') then
    raise exception 'ENROLLMENT_CREATE_FORBIDDEN' using errcode = '42501';
  end if;

  if pg_catalog.jsonb_typeof(coalesce(p_payment_records, '[]'::jsonb)) <> 'array' then
    raise exception 'PAYMENT_RECORDS_INVALID';
  end if;

  select pg_catalog.array_agg(normalized.course_name order by normalized.course_name)
  into v_course_names
  from (
    select min(pg_catalog.btrim(input.course_name)) as course_name
    from pg_catalog.unnest(coalesce(p_course_names, array[]::text[])) as input(course_name)
    where nullif(pg_catalog.btrim(input.course_name), '') is not null
    group by pg_catalog.lower(pg_catalog.btrim(input.course_name))
  ) normalized;

  if coalesce(pg_catalog.cardinality(v_course_names), 0) = 0 then
    raise exception 'COURSE_REQUIRED';
  end if;
  if nullif(pg_catalog.btrim(p_season), '') is null then
    raise exception 'SEASON_REQUIRED';
  end if;
  if not exists (
    select 1 from public.students s where s.student_id = p_student_id
  ) then
    raise exception 'STUDENT_NOT_FOUND';
  end if;
  if exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and e.season = p_season
  ) then
    raise exception 'ENROLLMENT_ALREADY_EXISTS';
  end if;

  for v_payment in
    select value
    from pg_catalog.jsonb_array_elements(coalesce(p_payment_records, '[]'::jsonb))
  loop
    if pg_catalog.jsonb_typeof(v_payment) <> 'object'
       or pg_catalog.jsonb_typeof(v_payment -> 'course_names') <> 'array' then
      raise exception 'PAYMENT_COURSE_REQUIRED';
    end if;

    select pg_catalog.array_agg(value #>> '{}')
    into v_payment_course_names
    from pg_catalog.jsonb_array_elements(v_payment -> 'course_names');
    if coalesce(pg_catalog.cardinality(v_payment_course_names), 0) = 0 then
      raise exception 'PAYMENT_COURSE_REQUIRED';
    end if;

    v_amount_text := nullif(pg_catalog.btrim(v_payment ->> 'amount'), '');
    if v_amount_text is null then
      raise exception 'PAYMENT_AMOUNT_REQUIRED';
    end if;
    if v_amount_text !~ '^\d+$' then
      raise exception 'PAYMENT_AMOUNT_INVALID';
    end if;
    begin
      v_amount := v_amount_text::integer;
    exception when numeric_value_out_of_range then
      raise exception 'PAYMENT_AMOUNT_INVALID';
    end;
    if v_amount < 0 then
      raise exception 'PAYMENT_AMOUNT_INVALID';
    end if;

    foreach v_course_name in array v_payment_course_names
    loop
      if not exists (
        select 1
        from pg_catalog.unnest(v_course_names) as selected(course_name)
        where pg_catalog.lower(pg_catalog.btrim(selected.course_name)) =
              pg_catalog.lower(pg_catalog.btrim(v_course_name))
      ) then
        raise exception 'PAYMENT_COURSE_NOT_SELECTED';
      end if;
      if pg_catalog.lower(pg_catalog.btrim(v_course_name)) = any(v_seen_payment_courses) then
        raise exception 'PAYMENT_COURSE_DUPLICATE';
      end if;
      v_seen_payment_courses := pg_catalog.array_append(
        v_seen_payment_courses,
        pg_catalog.lower(pg_catalog.btrim(v_course_name))
      );
    end loop;
  end loop;

  insert into public.enrollments (
    student_id, season, reg_type, pre_test, post_test, refunded, refund_info
  ) values (
    p_student_id, p_season, p_reg_type, p_pre_test, p_post_test, p_refunded, p_refund_info
  ) returning enrollment_id into v_enrollment_id;

  insert into public.courses (enrollment_id, course_name)
  select v_enrollment_id, course_name
  from pg_catalog.unnest(v_course_names) as selected(course_name);

  for v_payment in
    select value from pg_catalog.jsonb_array_elements(coalesce(p_payment_records, '[]'::jsonb))
  loop
    v_amount := (v_payment ->> 'amount')::integer;
    insert into public.billing_receipts (amount, invoice_number)
    values (v_amount, nullif(pg_catalog.btrim(v_payment ->> 'invoice_number'), ''))
    returning receipt_id into v_receipt_id;

    for v_course_name in
      select value #>> '{}'
      from pg_catalog.jsonb_array_elements(v_payment -> 'course_names')
    loop
      insert into public.billing_receipt_courses (receipt_id, course_id)
      select v_receipt_id, c.course_id
      from public.courses c
      where c.enrollment_id::text = v_enrollment_id::text
        and pg_catalog.lower(pg_catalog.btrim(c.course_name)) =
            pg_catalog.lower(pg_catalog.btrim(v_course_name));
    end loop;
  end loop;

  return v_enrollment_id::text;
end;
$$;
```

用 pgTAP cases 證明每個驗證分支先於 INSERT 執行。最後撤銷 public/anon/舊 overload 權限，僅將新簽章 execute 授予 authenticated。

- [ ] **Step 6: 實作 grouped receipt CRUD RPCs**

建立 Task Interfaces 所列三個函式。共同規則：

```sql
if public.current_app_role() not in ('editor', 'admin') then
  raise exception 'PAYMENT_FORBIDDEN' using errcode = '42501';
end if;
if p_amount is null then raise exception 'PAYMENT_AMOUNT_REQUIRED'; end if;
if p_amount < 0 then raise exception 'PAYMENT_AMOUNT_INVALID'; end if;
```

`create_billing_receipt` 先拒絕空 `p_course_ids`，再用以下查詢同時驗證 ID 存在、同 enrollment 與尚未繳費：

```sql
select count(*)::integer, count(distinct c.enrollment_id)::integer
into v_course_count, v_enrollment_count
from public.courses c
where c.course_id = any(p_course_ids);

if v_course_count <> pg_catalog.cardinality(p_course_ids) then
  raise exception 'PAYMENT_COURSE_NOT_FOUND';
end if;
if v_enrollment_count <> 1 then
  raise exception 'PAYMENT_CROSS_ENROLLMENT';
end if;
if exists (
  select 1 from public.billing_receipt_courses link
  where link.course_id = any(p_course_ids)
) then
  raise exception 'PAYMENT_ALREADY_EXISTS';
end if;
```

成功後 insert header 與所有 links，回傳：

```sql
return pg_catalog.jsonb_build_object(
  'receipt_id', v_receipt_id,
  'course_ids', pg_catalog.to_jsonb(p_course_ids),
  'amount', p_amount,
  'invoice_number', nullif(pg_catalog.btrim(p_invoice_number), '')
);
```

`update_billing_receipt` 鎖定 header、只更新 `amount` / `invoice_number` 並回傳相同 shape；不存在時丟 `PAYMENT_NOT_FOUND`。`delete_billing_receipt` 鎖定後刪除 header，link 由 cascade 清除。

- [ ] **Step 7: 將選課更新與刪除保護切換到新關聯表**

在同一 migration 以現有 text-ID 簽章 `create or replace function public.update_enrollment_with_courses(text, text, text, text, text, integer, text, text[])`，保留既有課程 diff 邏輯，只將「已有收據的課程不能移除」查詢改為：

```sql
if exists (
  select 1
  from public.courses c
  join public.billing_receipt_courses link on link.course_id = c.course_id
  where c.enrollment_id::text = p_enrollment_id
    and not exists (
      select 1
      from pg_catalog.unnest(v_names) as selected(course_name)
      where pg_catalog.lower(pg_catalog.btrim(selected.course_name)) =
            pg_catalog.lower(pg_catalog.btrim(c.course_name))
    )
) then
  raise exception 'COURSE_RECEIPT_LOCKED';
end if;
```

同時取代 courses delete policy，讓 editor/admin 只能刪除新模型中未繳費的課程：

```sql
drop policy if exists "role editors can delete unbilled courses" on public.courses;

create policy "role editors can delete unbilled courses"
on public.courses for delete to authenticated
using (
  public.current_app_role() in ('editor', 'admin')
  and not exists (
    select 1
    from public.billing_receipt_courses link
    where link.course_id = courses.course_id
  )
);
```

因所有舊 `course_receipts` 已先回填，且相容 trigger 會同步後續舊寫入，policy 不需要同時查兩張表。

- [ ] **Step 8: 執行資料庫 GREEN tests**

Run:

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/billing_receipts_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/enrollment_billing_fields_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/seasonal_import_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/student_id_reconciliation_test.sql
```

Expected: PASS。若 linked target 尚未套用 migration，先依專案既有 Supabase migration 流程套用到測試環境，不得直接在正式環境試跑。

- [ ] **Step 9: 檢查 migration 與 Commit**

```powershell
git diff --check -- supabase/migrations/20260810120000_grouped_billing_receipts.sql supabase/tests/database/billing_receipts_test.sql supabase/tests/database/enrollment_billing_fields_test.sql
git add -- supabase/migrations/20260810120000_grouped_billing_receipts.sql supabase/tests/database/billing_receipts_test.sql supabase/tests/database/enrollment_billing_fields_test.sql
git commit -m "feat(db): add grouped billing receipts"
```

---

### Task 3: 將前端 service 切換到 payment-record RPC

**Files:**
- Modify: `dashboard/src/services/enrollmentService.js`
- Modify: `dashboard/src/services/enrollmentService.test.js`
- Create: `dashboard/src/services/billingReceiptService.js`
- Create: `dashboard/src/services/billingReceiptService.test.js`

**Interfaces:**
- Consumes: Task 1 `normalizePaymentRecords()`。
- Produces: `createEnrollmentWithCourses(client, studentId, form) -> { enrollment_id: string }`。
- Produces: `createBillingReceipt(client, courseIds, billing)`、`updateBillingReceipt(client, receiptId, billing)`、`deleteBillingReceipt(client, receiptId)`。
- Billing result: `{ receiptId, courseIds, amount, invoiceNumber }`。

- [ ] **Step 1: 更新 service RED tests**

在 `enrollmentService.test.js` 將 create test 的 form 改為：

```js
{
  season: '第十六季',
  reg_type: '續',
  pre_test: '',
  post_test: '',
  refunded: false,
  refund_info: '',
  courses: ['A', 'B', 'C'],
  paymentRecords: [
    { localId: 'p1', courseNames: ['A'], amount: '1000', invoiceNumber: ' A001 ' },
    { localId: 'p2', courseNames: ['B', 'C'], amount: '2000', invoiceNumber: '' },
  ],
}
```

斷言 `client.rpc` 接收：

```js
expect(client.rpc).toHaveBeenCalledWith('create_enrollment_with_courses', {
  p_student_id: '1',
  p_season: '第十六季',
  p_reg_type: '續',
  p_pre_test: '',
  p_post_test: '',
  p_refunded: 0,
  p_refund_info: '',
  p_course_names: ['A', 'B', 'C'],
  p_payment_records: [
    { course_names: ['A'], amount: 1000, invoice_number: 'A001' },
    { course_names: ['B', 'C'], amount: 2000, invoice_number: null },
  ],
})
expect(result).toEqual({ enrollment_id: 'enrollment-42' })
```

建立 `billingReceiptService.test.js`，用 `client.rpc = vi.fn()` 驗證 create/update/delete 三個函式名稱、payload、回傳 camelCase shape，以及固定 RPC error mapping。

- [ ] **Step 2: 執行 RED tests**

```powershell
npm test -- src/services/enrollmentService.test.js src/services/billingReceiptService.test.js
```

Expected: FAIL，create payload 仍含 `p_amount` / `p_invoice_number`，且新 service module 不存在。

- [ ] **Step 3: 修改 enrollment service**

將 `createEnrollmentWithCourses` 改為：

```js
import { normalizePaymentRecords } from '../domain/enrollmentPayments'

export async function createEnrollmentWithCourses(client, studentId, form) {
  const courseNames = normalizeSelectedCourseNames(form.courses)
  if (courseNames.length === 0) throw new Error('請至少選擇一門課程')

  const paymentRecords = normalizePaymentRecords(form.paymentRecords, courseNames)
  const { data, error } = await client.rpc('create_enrollment_with_courses', {
    p_student_id: studentId,
    p_season: form.season,
    p_reg_type: form.reg_type,
    p_pre_test: form.pre_test,
    p_post_test: form.post_test,
    p_refunded: form.refunded ? 1 : 0,
    p_refund_info: form.refund_info,
    p_course_names: courseNames,
    p_payment_records: paymentRecords,
  })

  if (error) throw new Error(mapEnrollmentCreateError(error.message))
  return { enrollment_id: String(data) }
}
```

新增純 `mapEnrollmentCreateError`：

```js
function mapEnrollmentCreateError(message) {
  return {
    ENROLLMENT_CREATE_FORBIDDEN: '你沒有新增選課的權限',
    COURSE_REQUIRED: '請至少選擇一門課程',
    SEASON_REQUIRED: '請輸入有效的季度，例如：第十六季',
    STUDENT_NOT_FOUND: '找不到學員，請重新整理',
    ENROLLMENT_ALREADY_EXISTS: '此學員在該季度已有選課紀錄',
    PAYMENT_RECORDS_INVALID: '繳費資料格式不正確',
    PAYMENT_COURSE_REQUIRED: '繳費紀錄必須至少選擇一門課程',
    PAYMENT_AMOUNT_REQUIRED: '請輸入繳費金額',
    PAYMENT_AMOUNT_INVALID: '金額必須為 0 或正整數',
    PAYMENT_COURSE_NOT_SELECTED: '繳費紀錄包含未選擇的課程',
    PAYMENT_COURSE_DUPLICATE: '同一門課不能出現在多筆繳費紀錄',
  }[message] || message
}
```

- [ ] **Step 4: 建立 billing receipt service**

建立 `billingReceiptService.js`：

```js
import { normalizePaymentAmount } from '../domain/enrollmentPayments'

function mapReceipt(data) {
  return {
    receiptId: data.receipt_id,
    courseIds: data.course_ids || [],
    amount: data.amount,
    invoiceNumber: data.invoice_number,
  }
}

function mapReceiptError(message) {
  return {
    PAYMENT_FORBIDDEN: '你沒有修改繳費紀錄的權限',
    PAYMENT_COURSE_REQUIRED: '請至少選擇一門課程',
    PAYMENT_AMOUNT_REQUIRED: '請輸入繳費金額',
    PAYMENT_AMOUNT_INVALID: '金額必須為 0 或正整數',
    PAYMENT_COURSE_NOT_FOUND: '找不到選取的課程，請重新整理',
    PAYMENT_CROSS_ENROLLMENT: '同一筆繳費不能包含不同季度的課程',
    PAYMENT_ALREADY_EXISTS: '其中一門課已有繳費紀錄，請重新整理',
    PAYMENT_NOT_FOUND: '找不到繳費紀錄，請重新整理',
  }[message] || message
}

function normalizeBilling(billing) {
  return {
    amount: normalizePaymentAmount(billing.amount),
    invoiceNumber: String(billing.invoiceNumber ?? '').trim() || null,
  }
}

export async function createBillingReceipt(client, courseIds, billing) {
  const normalized = normalizeBilling(billing)
  const { data, error } = await client.rpc('create_billing_receipt', {
    p_course_ids: courseIds,
    p_amount: normalized.amount,
    p_invoice_number: normalized.invoiceNumber,
  })
  if (error) throw new Error(mapReceiptError(error.message))
  return mapReceipt(data)
}

export async function updateBillingReceipt(client, receiptId, billing) {
  const normalized = normalizeBilling(billing)
  const { data, error } = await client.rpc('update_billing_receipt', {
    p_receipt_id: receiptId,
    p_amount: normalized.amount,
    p_invoice_number: normalized.invoiceNumber,
  })
  if (error) throw new Error(mapReceiptError(error.message))
  return mapReceipt(data)
}

export async function deleteBillingReceipt(client, receiptId) {
  const { error } = await client.rpc('delete_billing_receipt', { p_receipt_id: receiptId })
  if (error) throw new Error(mapReceiptError(error.message))
}
```

- [ ] **Step 5: 執行 GREEN tests 與 Commit**

```powershell
npm test -- src/domain/enrollmentPayments.test.js src/services/enrollmentService.test.js src/services/billingReceiptService.test.js
git add -- dashboard/src/services/enrollmentService.js dashboard/src/services/enrollmentService.test.js dashboard/src/services/billingReceiptService.js dashboard/src/services/billingReceiptService.test.js
git commit -m "feat(billing): add grouped receipt service adapters"
```

Expected: PASS。

---

### Task 4: 建立不重複的 dashboard billing read model

**Files:**
- Modify: `dashboard/src/domain/enrollmentBilling.js`
- Modify: `dashboard/src/domain/enrollmentBilling.test.js`
- Modify: `dashboard/src/services/dashboardDataService.js`
- Modify: `dashboard/src/services/dashboardDataService.test.js`
- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx`

**Interfaces:**
- Consumes: Supabase nested `courses -> billing_receipt_courses -> billing_receipts` rows。
- Produces: `normalizeEnrollmentBilling(courseRows) -> { courseDetails, billingReceipts }`。
- `courseDetails`: `{ courseId, courseName, billingReceiptId }[]`。
- `billingReceipts`: `{ receiptId, amount, invoiceNumber, courses: { courseId, courseName }[] }[]`。
- `summarizeEnrollmentBilling(enrollment)` 只按 unique receipt header 加總一次。

- [ ] **Step 1: 寫 read-model RED tests**

更新 `enrollmentBilling.test.js`，使用一張收據同時出現在 A、B 兩個 course links 的 fixture：

```js
const nestedCourses = [
  {
    course_id: 10,
    course_name: 'A',
    billing_receipt_courses: [{
      billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' },
    }],
  },
  {
    course_id: 11,
    course_name: 'B',
    billing_receipt_courses: [{
      billing_receipts: { receipt_id: 100, amount: 3000, invoice_number: 'R-1' },
    }],
  },
  { course_id: 12, course_name: 'C', billing_receipt_courses: [] },
]

expect(normalizeEnrollmentBilling(nestedCourses)).toEqual({
  courseDetails: [
    { courseId: 10, courseName: 'A', billingReceiptId: 100 },
    { courseId: 11, courseName: 'B', billingReceiptId: 100 },
    { courseId: 12, courseName: 'C', billingReceiptId: null },
  ],
  billingReceipts: [{
    receiptId: 100,
    amount: 3000,
    invoiceNumber: 'R-1',
    courses: [
      { courseId: 10, courseName: 'A' },
      { courseId: 11, courseName: 'B' },
    ],
  }],
})
```

斷言 `summarizeEnrollmentBilling({ billingReceipts: normalized.billingReceipts })` 回傳 3000，不是 6000。保留 legacy fallback 與 migrated null amount cases。

更新 `dashboardDataService.test.js`，期望 select expression 為：

```js
'*, courses(*, billing_receipt_courses(*, billing_receipts(*)))'
```

並斷言 enrollment 同時具有 `courseDetails`、`billingReceipts`、既有 `courses` string array。

更新 `EnrollmentEditForm.test.jsx`，將 locked fixture 改成 `billingReceiptId: 100`，證明已有繳費的 A 不可移除。

- [ ] **Step 2: 執行 RED tests**

```powershell
npm test -- src/domain/enrollmentBilling.test.js src/services/dashboardDataService.test.js src/components/enrollment/EnrollmentEditForm.test.jsx
```

Expected: FAIL，舊 normalize 仍讀 `course_receipts`。

- [ ] **Step 3: 實作 read model**

在 `enrollmentBilling.js` 以 Map 按 `receipt_id` 聚合：

```js
function first(value) {
  if (Array.isArray(value)) return value[0] || null
  return value || null
}

export function normalizeEnrollmentBilling(courseRows = []) {
  const receiptMap = new Map()
  const courseDetails = courseRows.map(course => {
    const link = first(course.billing_receipt_courses)
    const receipt = first(link?.billing_receipts)
    const courseDetail = {
      courseId: course.course_id,
      courseName: course.course_name,
      billingReceiptId: receipt?.receipt_id ?? null,
    }

    if (receipt) {
      const normalizedReceipt = receiptMap.get(receipt.receipt_id) || {
        receiptId: receipt.receipt_id,
        amount: receipt.amount,
        invoiceNumber: receipt.invoice_number,
        courses: [],
      }
      normalizedReceipt.courses.push({
        courseId: course.course_id,
        courseName: course.course_name,
      })
      receiptMap.set(receipt.receipt_id, normalizedReceipt)
    }

    return courseDetail
  })

  return { courseDetails, billingReceipts: [...receiptMap.values()] }
}
```

`summarizeEnrollmentBilling` 改讀 `enrollment.billingReceipts`；有至少一筆 header 時，加總 non-null amount 並去重 invoice，否則才讀 enrollment legacy fields。

`dashboardDataService.js` 使用新 select expression 與 normalizer。`EnrollmentEditForm.jsx` 從 `course.billingReceiptId != null` 產生 locked course names。

- [ ] **Step 4: 執行 GREEN tests 與 Commit**

```powershell
npm test -- src/domain/enrollmentBilling.test.js src/services/dashboardDataService.test.js src/components/enrollment/EnrollmentEditForm.test.jsx
git add -- dashboard/src/domain/enrollmentBilling.js dashboard/src/domain/enrollmentBilling.test.js dashboard/src/services/dashboardDataService.js dashboard/src/services/dashboardDataService.test.js dashboard/src/components/enrollment/EnrollmentEditForm.jsx dashboard/src/components/enrollment/EnrollmentEditForm.test.jsx
git commit -m "refactor(billing): normalize grouped receipt read model"
```

Expected: PASS。

---

### Task 5: 建立共用 PaymentRecordsEditor

**Files:**
- Create: `dashboard/src/components/enrollment/PaymentRecordsEditor.jsx`
- Create: `dashboard/src/components/enrollment/PaymentRecordsEditor.test.jsx`
- Create: `dashboard/src/components/enrollment/paymentRecords.css`

**Interfaces:**
- Props: `{ selectedCourseNames, records, onChange, disabled = false }`。
- Consumes/produces record: `{ localId, courseNames, amount, invoiceNumber }`。
- UI copy: `新增繳費紀錄`、`涵蓋課程`、`總金額`、`發票編號`、`移除繳費紀錄`。

- [ ] **Step 1: 寫 component RED tests**

建立測試並用 controlled harness 更新 props：

```jsx
function Harness({ selectedCourseNames = ['A', 'B', 'C'] }) {
  const [records, setRecords] = useState([])
  return (
    <PaymentRecordsEditor
      selectedCourseNames={selectedCourseNames}
      records={records}
      onChange={setRecords}
    />
  )
}
```

具體 cases：

```js
it('creates a draft and assigns multiple courses to one payment', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  fireEvent.click(screen.getByLabelText('A'))
  fireEvent.click(screen.getByLabelText('B'))
  fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '3000' } })
  fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: 'R-1' } })
  expect(screen.getByLabelText('A').checked).toBe(true)
  expect(screen.getByLabelText('B').checked).toBe(true)
  expect(screen.getByDisplayValue('3000')).toBeTruthy()
})

it('prevents a course assigned to another payment from being selected again', () => {
  render(<Harness />)
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  fireEvent.click(screen.getByLabelText('A'))
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  expect(screen.getAllByLabelText('A').at(-1).disabled).toBe(true)
})
```

另測：移除 draft 會釋放課程、全部課程分配後 add button disabled、`disabled` 時所有 inputs/buttons disabled、每筆 fieldset 有可讀 legend 且 input IDs 不重複。

- [ ] **Step 2: 執行 RED test**

```powershell
npm test -- src/components/enrollment/PaymentRecordsEditor.test.jsx
```

Expected: FAIL，module 不存在。

- [ ] **Step 3: 實作 controlled editor**

元件以 `useRef(0)` 產生 `payment-${counter}` local ID，不依賴 array index。新增 draft 初值：

```js
const nextRecord = {
  localId: `payment-${++nextLocalIdRef.current}`,
  courseNames: [],
  amount: '',
  invoiceNumber: '',
}
```

使用 `assignedElsewhere` 判斷 checkbox disabled：

```js
const assignedElsewhere = records.some(
  candidate => candidate.localId !== record.localId && candidate.courseNames.includes(courseName),
)
```

所有 record 更新都使用 `onChange(records.map(...))` 產生新陣列；移除使用 filter。每筆以 `<fieldset>` 包住課程、金額、發票與 remove button。CSS 只使用 `.payment-records-*` 前綴，避免污染其他 modal。

- [ ] **Step 4: 執行 GREEN test 與 Commit**

```powershell
npm test -- src/components/enrollment/PaymentRecordsEditor.test.jsx
git add -- dashboard/src/components/enrollment/PaymentRecordsEditor.jsx dashboard/src/components/enrollment/PaymentRecordsEditor.test.jsx dashboard/src/components/enrollment/paymentRecords.css
git commit -m "feat(enrollment): add payment records editor"
```

Expected: PASS。

---

### Task 6: 將 AddEnrollModal 接上原子繳費流程與 dialog 行為

**Files:**
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.jsx`
- Modify: `dashboard/src/components/enrollment/AddEnrollModal.test.jsx`
- Modify: `dashboard/src/components/enrollment/CourseTagPicker.jsx`
- Modify: `dashboard/src/components/enrollment/CourseTagPicker.test.jsx`

**Interfaces:**
- Consumes: Task 1 `reconcilePaymentRecords`、Task 3 `createEnrollmentWithCourses`、Task 5 `PaymentRecordsEditor`。
- Produces: 成功時恰好一次 `onRefresh()` 與 `onClose()`；失敗時保留輸入並呈現 `role="alert"`。
- Dialog contract: `role="dialog"`、`aria-modal="true"`、`aria-labelledby="add-enrollment-title"`、focus trap、focus restore、非送出中 Esc 關閉。

- [ ] **Step 1: 擴充 AddEnrollModal RED tests**

調整 CourseTagPicker mock，使 A/B/C 可獨立切換。加入：

```js
it('submits one payment covering multiple selected courses', async () => {
  createEnrollmentWithCourses.mockResolvedValue({ enrollment_id: '42' })
  const onClose = vi.fn()
  const onRefresh = vi.fn()
  render(<AddEnrollModal student={student} onClose={onClose} onRefresh={onRefresh} />)

  fireEvent.click(screen.getByRole('button', { name: 'Course A' }))
  fireEvent.click(screen.getByRole('button', { name: 'Course B' }))
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  fireEvent.click(screen.getByLabelText('Course A'))
  fireEvent.click(screen.getByLabelText('Course B'))
  fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '3000' } })
  fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: 'R-1' } })
  fireEvent.click(screen.getByRole('button', { name: '新增選課' }))

  await waitFor(() => expect(createEnrollmentWithCourses).toHaveBeenCalledOnce())
  expect(createEnrollmentWithCourses.mock.calls[0][2]).toMatchObject({
    courses: ['Course A', 'Course B'],
    paymentRecords: [{
      courseNames: ['Course A', 'Course B'],
      amount: '3000',
      invoiceNumber: 'R-1',
    }],
  })
  expect(onRefresh).toHaveBeenCalledOnce()
  expect(onClose).toHaveBeenCalledOnce()
})
```

另加入：不填 payment 可成功、invalid amount 不呼叫 service、pending promise 連點只呼叫一次、pending 時 overlay/Esc/cancel 不關閉、RPC failure 顯示 alert 且保留值、close button accessible name、Tab focus trap、unmount restore opener focus。

- [ ] **Step 2: 執行 RED tests**

```powershell
npm test -- src/components/enrollment/AddEnrollModal.test.jsx src/components/enrollment/CourseTagPicker.test.jsx
```

Expected: FAIL，新 payment UI 與 dialog behavior 尚不存在。

- [ ] **Step 3: 重構表單 state 與送出流程**

初始 state 移除 `paid`、`amount`、`invoice_number`，改為：

```js
const [newEnroll, setNewEnroll] = useState({
  season: defaultSeason,
  reg_type: '續',
  pre_test: '',
  post_test: '',
  refunded: false,
  refund_info: '',
  courses: [],
  paymentRecords: [],
})
const [isSubmitting, setIsSubmitting] = useState(false)
const [submitError, setSubmitError] = useState('')
const submitInFlightRef = useRef(false)
```

CourseTagPicker callback 必須同時 reconcile：

```js
onChange={courses => setNewEnroll(current => ({
  ...current,
  courses,
  paymentRecords: reconcilePaymentRecords(current.paymentRecords, courses),
}))}
```

送出 handler 改成真正的 async function，ref guard 設在第一行有效路徑，並在 `finally` 釋放：

```js
const handleAddEnrollSubmit = async event => {
  event.preventDefault()
  if (!student || submitInFlightRef.current) return

  setSubmitError('')
  const season = normalizeSeason(newEnroll.season)
  if (!season) {
    setSubmitError('請輸入有效的季度，例如：第十六季')
    return
  }
  if (newEnroll.courses.length === 0) {
    setSubmitError('請至少選擇一門課程')
    return
  }

  submitInFlightRef.current = true
  setIsSubmitting(true)
  let succeeded = false
  try {
    await createEnrollmentWithCourses(supabase, student.student_id, { ...newEnroll, season })
    succeeded = true
  } catch (error) {
    setSubmitError(error instanceof Error ? error.message : '新增選課失敗')
  } finally {
    submitInFlightRef.current = false
    setIsSubmitting(false)
  }

  if (succeeded) {
    onRefresh?.()
    onClose()
  }
}
```

把 `PaymentRecordsEditor` 放在 CourseTagPicker 後方。刪除原 paid checkbox、amount、invoice inputs 與所有 `alert()`。

- [ ] **Step 4: 補齊 dialog focus/keyboard contract**

沿用 `ExportOptionsDialog.jsx` 的 `getFocusableElements`、previous focus ref、初始 focus 與 Tab wrap 模式。`handleKeyDown` 先處理 Escape：

```js
if (event.key === 'Escape') {
  if (!isSubmitting) onClose()
  return
}
```

overlay、close、cancel 都改為 `isSubmitting ? undefined : onClose`；按鈕加 `disabled={isSubmitting}`。標題設 `id="add-enrollment-title"`，close button 加 `aria-label="關閉新增選課"`，錯誤區為 `<div role="alert">`。

- [ ] **Step 5: 移除 CourseTagPicker 無效 prop**

先檢查使用者現有 diff，再只移除 `CourseTagPicker` function signature 中的 `canManage` 與 `AddEnrollModal` / `EnrollmentEditForm` 呼叫端的 `canManage` attribute。測試加入斷言：傳入未知 prop 不應被當成權限控制；真正授權仍由父層與 RPC 負責。

- [ ] **Step 6: 執行 GREEN tests 與 Commit**

```powershell
npm test -- src/domain/enrollmentPayments.test.js src/components/enrollment/PaymentRecordsEditor.test.jsx src/components/enrollment/AddEnrollModal.test.jsx src/components/enrollment/CourseTagPicker.test.jsx
git add -- dashboard/src/components/enrollment/AddEnrollModal.jsx dashboard/src/components/enrollment/AddEnrollModal.test.jsx dashboard/src/components/enrollment/CourseTagPicker.jsx dashboard/src/components/enrollment/CourseTagPicker.test.jsx
git commit -m "feat(enrollment): create payments with enrollment"
```

Expected: PASS。

---

### Task 7: 將帳單明細切換為 grouped payment records

**Files:**
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx`
- Modify: `dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx`
- Modify: `dashboard/src/components/enrollment/enrollmentBillingDetail.css`
- Delete: `dashboard/src/services/courseReceiptService.js`
- Delete: `dashboard/src/services/courseReceiptService.test.js`

**Interfaces:**
- Consumes: `enrollment.billingReceipts` 與 `courseDetails[].billingReceiptId`。
- Consumes: Task 3 `createBillingReceipt`、`updateBillingReceipt`、`deleteBillingReceipt`。
- Produces: 每筆繳費列顯示 course tags、一次 amount、一次 invoice；新增 editor 可選一至多門未繳費課程。

- [ ] **Step 1: 將 modal tests 改成 grouped RED cases**

fixture 改為：

```js
const enrollment = {
  enrollment_id: '42',
  student_id: '1',
  season: '第十六季',
  refunded: false,
  amount: 2400,
  invoice_number: 'LEGACY-MULTI',
  courses: ['水彩', '書法', '瑜珈'],
  courseDetails: [
    { courseId: 10, courseName: '水彩', billingReceiptId: 100 },
    { courseId: 11, courseName: '書法', billingReceiptId: 100 },
    { courseId: 12, courseName: '瑜珈', billingReceiptId: null },
  ],
  billingReceipts: [{
    receiptId: 100,
    amount: 2400,
    invoiceNumber: 'R-100',
    courses: [
      { courseId: 10, courseName: '水彩' },
      { courseId: 11, courseName: '書法' },
    ],
  }],
}
```

替換 service mocks，加入具體 cases：

```js
it('renders one payment row for multiple courses without double-counting', () => {
  const { container } = renderModal()
  const row = container.querySelector('.billing-receipt-row')
  expect(within(row).getByText('水彩')).toBeTruthy()
  expect(within(row).getByText('書法')).toBeTruthy()
  expect(within(row).getAllByText('NT$ 2400')).toHaveLength(1)
  expect(within(row).getAllByText('R-100')).toHaveLength(1)
})

it('creates one payment for multiple unbilled courses', async () => {
  const expandedEnrollment = {
    ...enrollment,
    courseDetails: [
      ...enrollment.courseDetails,
      { courseId: 13, courseName: '太極', billingReceiptId: null },
    ],
  }
  createBillingReceipt.mockResolvedValue({
    receiptId: 101,
    courseIds: [12, 13],
    amount: 3000,
    invoiceNumber: 'R-101',
  })
  renderModal({ enrollment: expandedEnrollment })
  fireEvent.click(screen.getByRole('button', { name: '新增繳費紀錄' }))
  fireEvent.click(screen.getByLabelText('瑜珈'))
  fireEvent.click(screen.getByLabelText('太極'))
  fireEvent.change(screen.getByLabelText('總金額'), { target: { value: '3000' } })
  fireEvent.change(screen.getByLabelText('發票編號'), { target: { value: 'R-101' } })
  fireEvent.click(screen.getByRole('button', { name: '儲存繳費紀錄' }))
  await waitFor(() => expect(createBillingReceipt).toHaveBeenCalledWith(
    expect.anything(),
    [12, 13],
    { amount: '3000', invoiceNumber: 'R-101' },
  ))
})
```

保留並改寫 pending guard、失敗保留值、viewer read-only、edit amount/invoice、delete confirm、refund toggle、missing ID、legacy block tests。刪除「空白 receipt 可建立」case，改為空金額顯示 inline error 且不呼叫 service。

- [ ] **Step 2: 執行 RED test**

```powershell
npm test -- src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
```

Expected: FAIL，舊 modal 仍按 course receipt render。

- [ ] **Step 3: 重構 modal read/write flow**

- `existingReceipts` 改用 `enrollment.billingReceipts || []`。
- `availableCourses` 改用 `courseDetails.filter(course => course.billingReceiptId == null)`。
- editor create shape 為 `{ mode: 'create', courseIds: [], amount: '', invoiceNumber: '' }`。
- create mode 以 checkbox 支援多課；edit mode顯示既有 course tags，但只編輯 amount/invoice。
- `handleSave` 依 mode 呼叫 `createBillingReceipt` 或 `updateBillingReceipt`。
- 刪除改呼叫 `deleteBillingReceipt`，成功後 refresh。
- 既有 `saveInFlight` ref 與 `isSaving` state 保留，所有 navigation/create/edit/delete 在 pending 時 disabled。
- 服務失敗保留 editor；成功後清除 editor、顯示 `繳費紀錄已儲存` 並 refresh，不關閉 modal。
- 新建或編輯空金額由 Task 1 validator 拒絕，顯示 role alert。

CSS 將 `.course-receipt-*` 中仍有意義的區塊改為 `.billing-receipt-*`，course tag 使用 wrap layout；不要重複顯示同一筆 amount/invoice。

- [ ] **Step 4: 移除舊 direct-table service**

確認 repository 不再 import `courseReceiptService`：

```powershell
rg -n "courseReceiptService|createCourseReceipt|updateCourseReceipt|deleteCourseReceipt" dashboard/src
```

Expected before delete: 只剩舊 service 與舊 test。刪除兩檔後再次執行，Expected: no matches。

- [ ] **Step 5: 執行 GREEN tests 與 Commit**

```powershell
npm test -- src/services/billingReceiptService.test.js src/domain/enrollmentBilling.test.js src/components/enrollment/EnrollmentBillingDetailModal.test.jsx
git add -- dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx dashboard/src/components/enrollment/EnrollmentBillingDetailModal.test.jsx dashboard/src/components/enrollment/enrollmentBillingDetail.css dashboard/src/services/courseReceiptService.js dashboard/src/services/courseReceiptService.test.js
git commit -m "feat(billing): manage grouped payment records"
```

Expected: PASS。

---

### Task 8: 全面回歸、資料遷移檢查與 production build

**Files:**
- Modify only if verification exposes a defect: files already listed in Tasks 1–7
- Verify: `dashboard/package.json`
- Verify: `docs/superpowers/specs/2026-08-10-enrollment-payment-records-design.md`

**Interfaces:**
- Consumes: Tasks 1–7 complete implementation。
- Produces: database tests、完整 Vitest、lint、Vite production build 全部通過；舊 table 保留且 old-to-new bridge 可驗證。

- [ ] **Step 1: 靜態搜尋禁止的舊路徑與 UI copy**

```powershell
rg -n "p_amount|p_invoice_number" dashboard/src/services/enrollmentService.js dashboard/src/components/enrollment/AddEnrollModal.jsx
rg -n "course_receipts\(\*\)|courseReceiptService|createCourseReceipt|updateCourseReceipt|deleteCourseReceipt|是否已繳費|新增收據|儲存收據|canManage" dashboard/src
```

Expected: 兩個查詢都回報 no matches；不得有舊 create-enrollment billing params、舊 nested query、舊 service imports、舊 UI copy 或無效 `canManage` prop。Migration 與歷史設計文件不在此搜尋範圍。

- [ ] **Step 2: 執行所有 database tests**

```powershell
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/billing_receipts_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/enrollment_billing_fields_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/seasonal_import_test.sql
& 'C:\Users\user\scoop\shims\supabase.exe' test db --linked supabase/tests/database/student_id_reconciliation_test.sql
```

Expected: PASS。記錄每個檔案的 assertion count；任何 linked target migration mismatch 都先在測試環境處理，不跳過測試。

- [ ] **Step 3: 執行完整 frontend test suite**

Run from `dashboard/`:

```powershell
npm test
```

Expected: 所有 test files PASS，無 unhandled promise rejection 或 act warning。

- [ ] **Step 4: 執行 lint**

```powershell
npm run lint
```

Expected: exit 0，無 oxlint errors。

- [ ] **Step 5: 執行 production build**

```powershell
npm run build
```

Expected: Vite exit 0，`dist/` 產生，沒有 unresolved import、JSX parse error 或 missing export。

- [ ] **Step 6: 檢查 migration 回填報表**

在測試／staging Supabase SQL Editor 執行唯讀查詢：

```sql
select
  (select count(*) from public.course_receipts) as legacy_course_receipts,
  (select count(*) from public.billing_receipts where legacy_course_receipt_id is not null) as migrated_course_receipts,
  (select count(*) from public.billing_receipt_courses) as receipt_course_links,
  (select count(*) from public.billing_receipts where amount is null) as legacy_null_amounts;

select link.course_id, count(*)
from public.billing_receipt_courses link
group by link.course_id
having count(*) > 1;

select link.receipt_id, count(distinct c.enrollment_id::text)
from public.billing_receipt_courses link
join public.courses c on c.course_id = link.course_id
group by link.receipt_id
having count(distinct c.enrollment_id::text) > 1;
```

Expected: `legacy_course_receipts = migrated_course_receipts`；兩個 violation queries 均為 0 rows。`receipt_course_links` 可大於 migrated count，因為 enrollment-level 舊帳務與 grouped receipts 可能涵蓋多門課。

- [ ] **Step 7: 手動 smoke test**

使用 staging editor 帳號：

1. 建立 A 課且不填繳費，確認成功且無 billing receipt。
2. 建立 A/B/C，新增一筆涵蓋 A/B、金額 3000、發票 R-1，C 不分配；確認帳單只顯示一次 3000。
3. 建立 A/B/C/D，建立 A 單課收據與 B/C/D 共用收據；確認同季顯示兩筆。
4. 編輯 enrollment 新增 E，再於帳單明細替 E 補登。
5. 快速連點送出，確認只建立一次且只有一個成功流程。
6. 使用 viewer 帳號確認沒有新增／編輯／刪除 UI；直接 RPC 測試由 pgTAP 證明 42501。
7. 鍵盤測試 Tab wrap、Shift+Tab wrap、Esc 關閉與送出中 Esc 無效。

- [ ] **Step 8: 最終 diff 與 commit**

```powershell
git status --short
git diff --check
git diff --stat
```

Task 8 不預期產生程式碼修改。若任何驗證失敗，停止 completion，回到擁有該檔案的 Task 1–7，使用該 task 明列的精確檔案清單修正、重跑 RED/GREEN 與建立修正 commit；不得在 Task 8 建立混合範圍 commit。若全部通過，不建立空 commit。保留 `course_receipts`、相容 trigger 與 `legacy_course_receipt_id`；正式回填驗證完成後另開 cleanup spec/plan，才 drop 舊表與橋接。

---

## Completion Checklist

- [ ] Task 1–7 每個 commit 都只包含該 task 檔案。
- [ ] Database pgTAP tests 全數通過。
- [ ] 完整 `npm test` 通過。
- [ ] `npm run lint` 通過。
- [ ] `npm run build` 通過。
- [ ] staging 回填查詢沒有 duplicate course 或 cross-enrollment receipt。
- [ ] editor/viewer smoke test 通過。
- [ ] 未 drop 舊 `course_receipts`，cleanup 明確留待 production 驗證後的獨立 release。
