# Add Member Initial Enrollment Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the add-member modal with a two-step wizard that atomically creates a member, their first enrollment, selected courses, paper-form fees, dates, notes, and trusted handler-account snapshot.

**Architecture:** Keep `AddStudentModal` as the wizard state/submit boundary, move each step into a focused presentational component, and normalize enrollment input in a pure domain module before calling one service function. A new authenticated-only Postgres RPC validates trusted data and performs all inserts in one transaction; nullable enrollment columns preserve compatibility with historical rows.

**Tech Stack:** React 19, Vitest, Testing Library, Supabase JS 2.110, PostgreSQL 17, Supabase CLI 2.109, pgTAP, CSS.

## Global Constraints

- Follow strict TDD for every production change: write one focused test, run it and observe the expected failure, add minimal implementation, then rerun to green.
- Before executing Supabase work, read the current official `https://supabase.com/changelog.md` and the official database-function/RLS documentation; follow any applicable breaking changes.
- Do not add dependencies or modify the existing course-grouped `billing_receipts` model.
- Preserve the current `第16期`-style period format and reuse `CourseTagPicker`.
- Require period, start date, end date, and at least one course; all other new fields are optional.
- Store TWD values as nullable PostgreSQL `integer`; accept only `0..2147483647`.
- Keep `period_end_date >= period_start_date`.
- Derive `handled_by_user_id` and `handled_by_account` inside PostgreSQL from the authenticated request; never trust client values for them.
- Existing historical enrollment rows remain valid with null values in all new columns.
- Do not stage or commit the unrelated root-level untracked `App.jsx` or `AuthContext.jsx` files.

## File Structure

- Create `dashboard/src/domain/initialEnrollment.js`: pure normalization and validation for the initial-enrollment form.
- Create `dashboard/src/domain/initialEnrollment.test.js`: domain red/green tests.
- Create `supabase/tests/database/initial_enrollment_fields_test.sql`: schema and constraint tests.
- Create a CLI-named migration in `supabase/migrations/` for enrollment form columns and constraints.
- Create `supabase/tests/database/create_member_initial_enrollment_test.sql`: RPC permissions, success, trust-boundary, validation, and rollback tests.
- Create a CLI-named migration in `supabase/migrations/` for the atomic RPC and its private amount parser.
- Modify `dashboard/src/services/studentService.js`: add the single RPC service boundary and stable error mapping.
- Modify `dashboard/src/services/studentService.test.js`: service payload, return-value, stripping, and error tests.
- Create `dashboard/src/components/students/MemberProfileStep.jsx`: step-one fields only.
- Create `dashboard/src/components/students/MemberProfileStep.test.jsx`: step-one field contract.
- Create `dashboard/src/components/students/InitialEnrollmentStep.jsx`: step-two fields and course picker.
- Create `dashboard/src/components/students/InitialEnrollmentStep.test.jsx`: step-two field contract.
- Modify `dashboard/src/components/students/AddStudentModal.jsx`: wizard state, validation, submit lock, and success/error flow.
- Modify `dashboard/src/components/students/AddStudentModal.test.jsx`: wizard integration and behavior tests.
- Modify `dashboard/src/components/common/common.css`: small wizard progress/section/textarea styles.

---

### Task 1: Pure Initial-Enrollment Normalization

**Files:**
- Create: `dashboard/src/domain/initialEnrollment.test.js`
- Create: `dashboard/src/domain/initialEnrollment.js`

**Interfaces:**
- Consumes: `normalizePeriod(value)` from `dashboard/src/domain/period.js`.
- Produces: `normalizeInitialEnrollmentForm(form) -> normalized enrollment object` using database-shaped snake_case keys and `INITIAL_ENROLLMENT_ERROR_MESSAGES`.

- [ ] **Step 1: Write the failing normalization tests**

Create tests with this valid baseline and assertions:

```js
import { describe, expect, it } from 'vitest'
import { normalizeInitialEnrollmentForm } from './initialEnrollment'

const validForm = {
  period: '  第16期  ',
  period_start_date: '2026-09-01',
  period_end_date: '2026-12-31',
  courses: [' 肌力訓練 ', '肌力訓練', '北歐健走'],
  notes: '  需靠近出口  ',
  prepaid_amount: '',
  prepaid_receipt_number: ' P-001 ',
  tuition_fee: '2400',
  materials_fee: '0',
  membership_fee: '',
  fee_receipt_number: ' F-001 ',
  handled_by_name: ' 王小姐 ',
  handled_on: '2026-08-17',
}

describe('normalizeInitialEnrollmentForm', () => {
  it('normalizes dates, courses, optional text, and nullable integer fees', () => {
    expect(normalizeInitialEnrollmentForm(validForm)).toEqual({
      period: '第16期',
      period_start_date: '2026-09-01',
      period_end_date: '2026-12-31',
      courses: ['肌力訓練', '北歐健走'],
      notes: '需靠近出口',
      prepaid_amount: null,
      prepaid_receipt_number: 'P-001',
      tuition_fee: 2400,
      materials_fee: 0,
      membership_fee: null,
      fee_receipt_number: 'F-001',
      handled_by_name: '王小姐',
      handled_on: '2026-08-17',
    })
  })

  it.each([
    [{ ...validForm, period: '第一期' }, '請輸入有效期別，例如：第16期'],
    [{ ...validForm, period_start_date: '' }, '請選擇開始日期與結束日期'],
    [{ ...validForm, period_end_date: '2026-08-31' }, '結束日期不得早於開始日期'],
    [{ ...validForm, courses: [] }, '請至少選擇一門課程'],
    [{ ...validForm, tuition_fee: '-1' }, '金額必須是 0 或正整數'],
    [{ ...validForm, materials_fee: '1.5' }, '金額必須是 0 或正整數'],
    [{ ...validForm, membership_fee: '2147483648' }, '金額必須是 0 或正整數'],
  ])('rejects invalid form %#', (form, message) => {
    expect(() => normalizeInitialEnrollmentForm(form)).toThrow(message)
  })
})
```

- [ ] **Step 2: Run the domain test and verify RED**

Run from `dashboard/`:

```powershell
npm test -- src/domain/initialEnrollment.test.js
```

Expected: FAIL because `./initialEnrollment` does not exist.

- [ ] **Step 3: Implement the minimal pure normalizer**

Create `initialEnrollment.js` with these exact keys and limits:

```js
import { normalizePeriod } from './period'

export const INITIAL_ENROLLMENT_ERROR_MESSAGES = {
  period: '請輸入有效期別，例如：第16期',
  datesRequired: '請選擇開始日期與結束日期',
  dateOrder: '結束日期不得早於開始日期',
  courses: '請至少選擇一門課程',
  amount: '金額必須是 0 或正整數',
}

const INTEGER_MAX = 2147483647
const MONEY_KEYS = ['prepaid_amount', 'tuition_fee', 'materials_fee', 'membership_fee']
const OPTIONAL_TEXT_KEYS = [
  'notes', 'prepaid_receipt_number', 'fee_receipt_number', 'handled_by_name', 'handled_on',
]

function optionalMoney(value) {
  const text = String(value ?? '').trim()
  if (!text) return null
  if (!/^\d+$/.test(text)) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
  const amount = Number(text)
  if (!Number.isSafeInteger(amount) || amount > INTEGER_MAX) {
    throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.amount)
  }
  return amount
}

export function normalizeInitialEnrollmentForm(form) {
  const period = normalizePeriod(form.period)
  if (!period) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.period)

  const startDate = String(form.period_start_date ?? '').trim()
  const endDate = String(form.period_end_date ?? '').trim()
  if (!startDate || !endDate) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.datesRequired)
  if (endDate < startDate) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.dateOrder)

  const courses = [...new Set(
    (Array.isArray(form.courses) ? form.courses : [])
      .map(course => String(course ?? '').trim())
      .filter(Boolean),
  )]
  if (courses.length === 0) throw new Error(INITIAL_ENROLLMENT_ERROR_MESSAGES.courses)

  const normalized = {
    period,
    period_start_date: startDate,
    period_end_date: endDate,
    courses,
  }
  for (const key of OPTIONAL_TEXT_KEYS) normalized[key] = String(form[key] ?? '').trim() || null
  for (const key of MONEY_KEYS) normalized[key] = optionalMoney(form[key])
  return normalized
}
```

- [ ] **Step 4: Run the domain test and verify GREEN**

Run: `npm test -- src/domain/initialEnrollment.test.js`

Expected: all tests in the file PASS with no warnings.

- [ ] **Step 5: Commit the domain unit**

```powershell
git add dashboard/src/domain/initialEnrollment.js dashboard/src/domain/initialEnrollment.test.js
git commit -m "feat: validate initial enrollment form"
```

---

### Task 2: Enrollment Paper-Form Columns and Constraints

**Files:**
- Create: `supabase/tests/database/initial_enrollment_fields_test.sql`
- Create via Supabase CLI: migration named `add_member_initial_enrollment_fields` under `supabase/migrations/`; use the exact path printed by the CLI.

**Interfaces:**
- Consumes: current `public.enrollments` table and historical nullable-row compatibility.
- Produces: thirteen new enrollment columns and five named check constraints used by Task 3.

- [ ] **Step 1: Verify current Supabase guidance and CLI commands**

Read the current official changelog and official database/RLS function docs. Then run from the repository root:

```powershell
.\node_modules\.bin\supabase.cmd --version
.\node_modules\.bin\supabase.cmd migration new --help
.\node_modules\.bin\supabase.cmd test db --help
```

Expected: CLI reports version 2.109.x or newer and documents `migration new` plus `test db` syntax. If a breaking change affects migrations, functions, grants, or RLS, update this plan's command spelling before continuing without changing the approved behavior.

- [ ] **Step 2: Write the failing pgTAP schema test**

Create a transaction-wrapped test with `select plan(19);`. Assert all thirteen types using `col_type_is`, then assert a valid full row lives, reversed dates fail `enrollments_period_dates_order_check`, and each negative money field fails its matching constraint.

Use this setup and behavioral core:

```sql
begin;
select plan(19);

truncate table public.students restart identity cascade;
insert into public.students (student_id, name, gender, education)
values (8101, '欄位測試會員', '女', '高中');

select col_type_is('public', 'enrollments', 'period_start_date', 'date', 'start date uses date');
select col_type_is('public', 'enrollments', 'period_end_date', 'date', 'end date uses date');
select col_type_is('public', 'enrollments', 'notes', 'text', 'notes use text');
select col_type_is('public', 'enrollments', 'prepaid_amount', 'integer', 'prepaid amount uses integer');
select col_type_is('public', 'enrollments', 'prepaid_receipt_number', 'text', 'prepaid number uses text');
select col_type_is('public', 'enrollments', 'tuition_fee', 'integer', 'tuition uses integer');
select col_type_is('public', 'enrollments', 'materials_fee', 'integer', 'materials fee uses integer');
select col_type_is('public', 'enrollments', 'membership_fee', 'integer', 'membership fee uses integer');
select col_type_is('public', 'enrollments', 'fee_receipt_number', 'text', 'formal receipt number uses text');
select col_type_is('public', 'enrollments', 'handled_by_name', 'text', 'handler name uses text');
select col_type_is('public', 'enrollments', 'handled_by_user_id', 'uuid', 'handler user ID uses uuid');
select col_type_is('public', 'enrollments', 'handled_by_account', 'text', 'handler account uses text');
select col_type_is('public', 'enrollments', 'handled_on', 'date', 'handled date uses date');

select lives_ok(
  $$insert into public.enrollments (
      student_id, period, period_start_date, period_end_date,
      prepaid_amount, tuition_fee, materials_fee, membership_fee
    ) values (8101, '第1期', date '2026-09-01', date '2026-12-31', 0, 2400, 300, 100)$$,
  'valid paper-form enrollment fields are accepted'
);

select throws_like(
  $$insert into public.enrollments
      (student_id, period, period_start_date, period_end_date)
    values (8101, '第2期', date '2026-12-31', date '2026-09-01')$$,
  '%enrollments_period_dates_order_check%',
  'reversed dates are rejected'
);

select throws_like(
  $$insert into public.enrollments (student_id, period, prepaid_amount)
    values (8101, '第3期', -1)$$,
  '%enrollments_prepaid_amount_nonnegative%',
  'negative prepaid amount is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, tuition_fee)
    values (8101, '第4期', -1)$$,
  '%enrollments_tuition_fee_nonnegative%',
  'negative tuition is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, materials_fee)
    values (8101, '第5期', -1)$$,
  '%enrollments_materials_fee_nonnegative%',
  'negative materials fee is rejected'
);
select throws_like(
  $$insert into public.enrollments (student_id, period, membership_fee)
    values (8101, '第6期', -1)$$,
  '%enrollments_membership_fee_nonnegative%',
  'negative membership fee is rejected'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Run the schema test and verify RED**

Run: `.\node_modules\.bin\supabase.cmd test db supabase/tests/database/initial_enrollment_fields_test.sql`

Expected: FAIL because `period_start_date` and the other new columns do not exist.

- [ ] **Step 4: Generate and fill the migration**

Run:

```powershell
.\node_modules\.bin\supabase.cmd migration new add_member_initial_enrollment_fields
$fieldMigrationPath = (Get-ChildItem 'supabase\migrations\*_add_member_initial_enrollment_fields.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName)
if (-not $fieldMigrationPath) { throw 'Supabase CLI did not create the field migration' }
```

In `$fieldMigrationPath`, write:

```sql
begin;

alter table public.enrollments
  add column period_start_date date,
  add column period_end_date date,
  add column notes text,
  add column prepaid_amount integer,
  add column prepaid_receipt_number text,
  add column tuition_fee integer,
  add column materials_fee integer,
  add column membership_fee integer,
  add column fee_receipt_number text,
  add column handled_by_name text,
  add column handled_by_user_id uuid,
  add column handled_by_account text,
  add column handled_on date;

alter table public.enrollments
  add constraint enrollments_period_dates_order_check
    check (period_start_date is null or period_end_date is null or period_end_date >= period_start_date),
  add constraint enrollments_prepaid_amount_nonnegative
    check (prepaid_amount is null or prepaid_amount >= 0),
  add constraint enrollments_tuition_fee_nonnegative
    check (tuition_fee is null or tuition_fee >= 0),
  add constraint enrollments_materials_fee_nonnegative
    check (materials_fee is null or materials_fee >= 0),
  add constraint enrollments_membership_fee_nonnegative
    check (membership_fee is null or membership_fee >= 0);

commit;
```

Do not add a foreign key from `handled_by_user_id` to `auth.users`; the audit snapshot must survive account deletion. No new index is needed because the new fields are not query predicates in this scope.

- [ ] **Step 5: Reset the local schema and verify GREEN**

Run:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db supabase/tests/database/initial_enrollment_fields_test.sql
```

Expected: 19/19 pgTAP assertions PASS.

- [ ] **Step 6: Commit the schema unit**

Stage only the CLI-created migration and its test, then commit:

```powershell
$fieldMigrationPath = (Get-ChildItem 'supabase\migrations\*_add_member_initial_enrollment_fields.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName)
if (-not $fieldMigrationPath) { throw 'Field migration is missing' }
git add -- $fieldMigrationPath supabase/tests/database/initial_enrollment_fields_test.sql
git commit -m "feat: store enrollment form details"
```

---

### Task 3: Atomic and Authenticated Member-plus-Enrollment RPC

**Files:**
- Create: `supabase/tests/database/create_member_initial_enrollment_test.sql`
- Create via Supabase CLI: migration named `create_member_initial_enrollment_rpc` under `supabase/migrations/`; use the exact path printed by the CLI.

**Interfaces:**
- Consumes: `public.current_app_role()`, canonical `students` columns, Task 2 enrollment columns, and `courses(enrollment_id, course_name)`.
- Produces: `public.create_student_with_initial_enrollment(p_student jsonb, p_enrollment jsonb) returns jsonb` and private `optional_nonnegative_integer(jsonb,text)`.

- [ ] **Step 1: Write the failing RPC pgTAP test**

Create a transaction-wrapped test that sets a real-looking editor JWT:

```sql
begin;
select plan(22);
truncate table public.students restart identity cascade;

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor@example.com","app_metadata":{"app_role":"editor"}}',
  true
);

select has_function(
  'public', 'create_student_with_initial_enrollment', array['jsonb', 'jsonb'],
  'atomic member enrollment RPC exists'
);
select ok(not pg_catalog.has_function_privilege(
  'public', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'public cannot execute the RPC');
select ok(not pg_catalog.has_function_privilege(
  'anon', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'anon cannot execute the RPC');
select ok(pg_catalog.has_function_privilege(
  'authenticated', 'public.create_student_with_initial_enrollment(jsonb,jsonb)', 'execute'
), 'authenticated can execute the RPC');

select pg_catalog.set_config(
  'test.created',
  public.create_student_with_initial_enrollment(
    '{"email":" New.Member@Example.com ","name":" 新會員 ","gender":"女","phone":" 0912-345-678 ","birth_date":"1985-07-01","address":" 台北市 ","organization":" YMCA ","education":"高中"}'::jsonb,
    '{"period":"第16期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["肌力訓練","北歐健走"],"notes":" 靠近出口 ","prepaid_amount":500,"prepaid_receipt_number":" P-1 ","tuition_fee":2400,"materials_fee":300,"membership_fee":100,"fee_receipt_number":" F-1 ","handled_by_name":" 王小姐 ","handled_on":"2026-08-17","handled_by_user_id":"99999999-9999-4999-8999-999999999999","handled_by_account":"spoof@example.com"}'::jsonb
  )::text,
  true
);
```

Continue with these exact success, trust-boundary, validation, and compatibility assertions:

```sql
select ok(
  ((pg_catalog.current_setting('test.created')::jsonb ->> 'student_id')::bigint > 0),
  'RPC returns a positive student ID'
);
select ok(
  ((pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint > 0),
  'RPC returns a positive enrollment ID'
);
select is(
  (select pg_catalog.jsonb_build_array(email, name)
   from public.students
   where student_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'student_id')::bigint),
  '["new.member@example.com", "新會員"]'::jsonb,
  'student profile is normalized'
);
select is(
  (select pg_catalog.jsonb_build_object(
      'period', period, 'start', period_start_date, 'end', period_end_date,
      'notes', notes, 'prepaid', prepaid_amount, 'prepaid_no', prepaid_receipt_number,
      'tuition', tuition_fee, 'materials', materials_fee, 'membership', membership_fee,
      'fee_no', fee_receipt_number, 'handler', handled_by_name, 'handled_on', handled_on
    )
   from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  '{"period":"第16期","start":"2026-09-01","end":"2026-12-31","notes":"靠近出口","prepaid":500,"prepaid_no":"P-1","tuition":2400,"materials":300,"membership":100,"fee_no":"F-1","handler":"王小姐","handled_on":"2026-08-17"}'::jsonb,
  'paper-form enrollment values are stored and trimmed'
);
select is(
  (select handled_by_user_id
   from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  '11111111-1111-4111-8111-111111111111'::uuid,
  'handler user ID comes from auth.uid rather than payload'
);
select is(
  (select handled_by_account
   from public.enrollments
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  'editor@example.com',
  'handler account comes from the JWT rather than payload'
);
select is(
  (select pg_catalog.array_agg(course_name order by course_name)
   from public.courses
   where enrollment_id = (pg_catalog.current_setting('test.created')::jsonb ->> 'enrollment_id')::bigint),
  (select pg_catalog.array_agg(course_name order by course_name)
   from pg_catalog.unnest(array['北歐健走', '肌力訓練']::text[]) expected(course_name)),
  'all selected courses are created'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","email":"viewer@example.com","app_metadata":{"app_role":"viewer"}}',
  true
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"唯讀會員","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["肌力訓練"]}'::jsonb
  )$$,
  '42501', 'INITIAL_ENROLLMENT_CREATE_FORBIDDEN',
  'viewer cannot execute the mutation'
);

select pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","email":"editor@example.com","app_metadata":{"app_role":"editor"}}',
  true
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"錯誤期別","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第一期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["肌力訓練"]}'::jsonb
  )$$,
  'P0001', 'PERIOD_INVALID', 'invalid period is rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"缺少日期","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","courses":["肌力訓練"]}'::jsonb
  )$$,
  'P0001', 'PERIOD_DATES_REQUIRED', 'missing dates are rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"日期反轉","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-12-31","period_end_date":"2026-09-01","courses":["肌力訓練"]}'::jsonb
  )$$,
  'P0001', 'PERIOD_DATE_ORDER_INVALID', 'reversed dates are rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"缺少課程","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":[]}'::jsonb
  )$$,
  'P0001', 'COURSE_REQUIRED', 'missing courses are rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"錯誤金額","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["肌力訓練"],"tuition_fee":-1}'::jsonb
  )$$,
  'P0001', 'FEE_AMOUNT_INVALID', 'invalid money is rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"錯誤辦理日期","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["肌力訓練"],"handled_on":"2026-02-30"}'::jsonb
  )$$,
  'P0001', 'HANDLED_ON_INVALID', 'invalid handled date is rejected'
);
select throws_ok(
  $$select public.create_student_with_initial_enrollment(
    '{"name":"錯誤日期","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第17期","period_start_date":"2026-02-30","period_end_date":"2026-12-31","courses":["肌力訓練"]}'::jsonb
  )$$,
  'P0001', 'PERIOD_DATE_INVALID', 'invalid calendar date is rejected'
);
select lives_ok(
  $$insert into public.students (student_id, name, gender, education)
      values (8200, '歷史會員', '女', '高中');
    insert into public.enrollments (student_id, period)
      values (8200, '第99期')$$,
  'historical enrollments may leave new fields null'
);
```

Finally, inject a course failure and prove transaction rollback.

Use this rollback fixture inside the same test transaction:

```sql
create function pg_temp.fail_initial_course_insert()
returns trigger language plpgsql as $$
begin
  if new.course_name = '觸發回復' then raise exception 'TEST_COURSE_FAILURE'; end if;
  return new;
end
$$;
create trigger test_fail_initial_course_insert
before insert on public.courses
for each row execute function pg_temp.fail_initial_course_insert();

select throws_like(
  $$select public.create_student_with_initial_enrollment(
    '{"email":"rollback@example.com","name":"回復測試","gender":"男","education":"高中"}'::jsonb,
    '{"period":"第20期","period_start_date":"2026-09-01","period_end_date":"2026-12-31","courses":["觸發回復"]}'::jsonb
  )$$,
  '%TEST_COURSE_FAILURE%',
  'course failure aborts the RPC'
);
select is(
  (select count(*)::integer from public.students where email = 'rollback@example.com'),
  0,
  'course failure rolls back the inserted student'
);
```

Finish with `select * from finish(); rollback;`. Keep the declared plan count synchronized with the final 22 assertions.

- [ ] **Step 2: Run the RPC test and verify RED**

Run: `.\node_modules\.bin\supabase.cmd test db supabase/tests/database/create_member_initial_enrollment_test.sql`

Expected: FAIL at `has_function` because the RPC does not exist.

- [ ] **Step 3: Generate the RPC migration**

Run:

```powershell
.\node_modules\.bin\supabase.cmd migration new create_member_initial_enrollment_rpc
$rpcMigrationPath = (Get-ChildItem 'supabase\migrations\*_create_member_initial_enrollment_rpc.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName)
if (-not $rpcMigrationPath) { throw 'Supabase CLI did not create the RPC migration' }
```

- [ ] **Step 4: Implement the private money parser**

In the CLI-created migration, begin a transaction and add:

```sql
create or replace function private.optional_nonnegative_integer(
  p_payload jsonb,
  p_key text
) returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  raw_value jsonb;
  value_text text;
  parsed_value integer;
begin
  raw_value := p_payload -> p_key;
  if raw_value is null or pg_catalog.jsonb_typeof(raw_value) = 'null' then return null; end if;
  if pg_catalog.jsonb_typeof(raw_value) not in ('number', 'string') then
    raise exception 'FEE_AMOUNT_INVALID';
  end if;
  value_text := pg_catalog.btrim(raw_value #>> '{}');
  if value_text = '' then return null; end if;
  if value_text !~ '^\d+$' then raise exception 'FEE_AMOUNT_INVALID'; end if;
  begin
    parsed_value := value_text::integer;
  exception when numeric_value_out_of_range then
    raise exception 'FEE_AMOUNT_INVALID';
  end;
  return parsed_value;
end
$function$;

revoke all on function private.optional_nonnegative_integer(jsonb, text)
from public, anon, authenticated;
```

- [ ] **Step 5: Implement the atomic RPC**

Add the function below. Keep every reference schema-qualified because `search_path` is empty:

```sql
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
  if start_date_text is null or end_date_text is null then raise exception 'PERIOD_DATES_REQUIRED'; end if;
  if start_date_text !~ '^\d{4}-\d{2}-\d{2}$' or end_date_text !~ '^\d{4}-\d{2}-\d{2}$' then
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
  if end_date_value < start_date_value then raise exception 'PERIOD_DATE_ORDER_INVALID'; end if;

  if pg_catalog.jsonb_typeof(p_enrollment -> 'courses') is distinct from 'array' then
    raise exception 'COURSE_REQUIRED';
  end if;
  if exists (
    select 1 from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    where pg_catalog.jsonb_typeof(item.value) <> 'string'
       or nullif(pg_catalog.btrim(item.value #>> '{}'), '') is null
  ) then raise exception 'COURSE_REQUIRED'; end if;
  select pg_catalog.array_agg(course_name order by course_name)
  into normalized_courses
  from (
    select min(pg_catalog.btrim(item.value #>> '{}')) course_name
    from pg_catalog.jsonb_array_elements(p_enrollment -> 'courses') item(value)
    group by pg_catalog.lower(pg_catalog.btrim(item.value #>> '{}'))
  ) normalized;
  if coalesce(pg_catalog.cardinality(normalized_courses), 0) = 0 then raise exception 'COURSE_REQUIRED'; end if;

  handled_on_text := nullif(pg_catalog.btrim(p_enrollment ->> 'handled_on'), '');
  if handled_on_text is not null then
    if handled_on_text !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'HANDLED_ON_INVALID'; end if;
    begin handled_on_value := handled_on_text::date;
    exception when others then raise exception 'HANDLED_ON_INVALID'; end;
    if pg_catalog.to_char(handled_on_value, 'YYYY-MM-DD') <> handled_on_text then raise exception 'HANDLED_ON_INVALID'; end if;
  end if;

  begin
    birth_date_value := nullif(pg_catalog.btrim(p_student ->> 'birth_date'), '')::date;
  exception when others then raise exception 'INVALID_BIRTH_DATE'; end;
  supplied_student_id_text := nullif(pg_catalog.btrim(p_student ->> 'student_id'), '');
  if supplied_student_id_text is null then
    insert into public.students (email, name, gender, phone, birth_date, address, organization, education)
    values (
      nullif(pg_catalog.btrim(p_student ->> 'email'), ''), pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'), nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value, nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''), pg_catalog.btrim(p_student ->> 'education')
    ) returning student_id into new_student_id;
  else
    begin new_student_id := supplied_student_id_text::bigint;
    exception when others then raise exception 'INVALID_STUDENT_ID'; end;
    if new_student_id <= 0 then raise exception 'INVALID_STUDENT_ID'; end if;
    insert into public.students (student_id, email, name, gender, phone, birth_date, address, organization, education)
    values (
      new_student_id, nullif(pg_catalog.btrim(p_student ->> 'email'), ''), pg_catalog.btrim(p_student ->> 'name'),
      pg_catalog.btrim(p_student ->> 'gender'), nullif(pg_catalog.btrim(p_student ->> 'phone'), ''),
      birth_date_value, nullif(pg_catalog.btrim(p_student ->> 'address'), ''),
      nullif(pg_catalog.btrim(p_student ->> 'organization'), ''), pg_catalog.btrim(p_student ->> 'education')
    );
  end if;

  insert into public.enrollments (
    student_id, period, reg_type, refunded, refund_info,
    period_start_date, period_end_date, notes,
    prepaid_amount, prepaid_receipt_number,
    tuition_fee, materials_fee, membership_fee, fee_receipt_number,
    handled_by_name, handled_by_user_id, handled_by_account, handled_on
  ) values (
    new_student_id, normalized_period, '新', 0, null,
    start_date_value, end_date_value, nullif(pg_catalog.btrim(p_enrollment ->> 'notes'), ''),
    private.optional_nonnegative_integer(p_enrollment, 'prepaid_amount'),
    nullif(pg_catalog.btrim(p_enrollment ->> 'prepaid_receipt_number'), ''),
    private.optional_nonnegative_integer(p_enrollment, 'tuition_fee'),
    private.optional_nonnegative_integer(p_enrollment, 'materials_fee'),
    private.optional_nonnegative_integer(p_enrollment, 'membership_fee'),
    nullif(pg_catalog.btrim(p_enrollment ->> 'fee_receipt_number'), ''),
    nullif(pg_catalog.btrim(p_enrollment ->> 'handled_by_name'), ''),
    actor_user_id, actor_account, handled_on_value
  ) returning enrollment_id into new_enrollment_id;

  insert into public.courses (enrollment_id, course_name)
  select new_enrollment_id, course_name
  from pg_catalog.unnest(normalized_courses) selected(course_name);

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

- [ ] **Step 6: Reset and run RPC plus regression database tests**

Run:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db supabase/tests/database/create_member_initial_enrollment_test.sql
.\node_modules\.bin\supabase.cmd test db
```

Expected: the new 22-assertion test and every existing database test PASS.

- [ ] **Step 7: Inspect privileges and security diagnostics**

Run `.\node_modules\.bin\supabase.cmd db advisors --help`, then run the documented local advisors command. Confirm there is no function search-path warning, no public/anon execute grant, and no new unprotected public table.

- [ ] **Step 8: Commit the RPC unit**

Stage only the CLI-created RPC migration and RPC test, then commit:

```powershell
$rpcMigrationPath = (Get-ChildItem 'supabase\migrations\*_create_member_initial_enrollment_rpc.sql' | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName)
if (-not $rpcMigrationPath) { throw 'RPC migration is missing' }
git add -- $rpcMigrationPath supabase/tests/database/create_member_initial_enrollment_test.sql
git commit -m "feat: create member and enrollment atomically"
```

---

### Task 4: Frontend RPC Service Boundary

**Files:**
- Modify: `dashboard/src/services/studentService.test.js`
- Modify: `dashboard/src/services/studentService.js`

**Interfaces:**
- Consumes: normalized student profile and Task 1's normalized enrollment object.
- Produces: `createStudentWithInitialEnrollment(client, student, enrollment) -> Promise<{student_id:number,enrollment_id:number}>`.

- [ ] **Step 1: Write failing service tests**

Add tests that prove exact RPC naming, trusted-field stripping, numeric return conversion, and stable error mapping:

```js
import { createStudentWithInitialEnrollment } from './studentService'

it('creates a member and first enrollment through one RPC without trusted actor fields', async () => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: { student_id: 61, enrollment_id: 91 }, error: null }) }
  const enrollment = {
    period: '第16期', period_start_date: '2026-09-01', period_end_date: '2026-12-31',
    courses: ['肌力訓練'], notes: null, prepaid_amount: 500,
    prepaid_receipt_number: 'P-1', tuition_fee: 2400, materials_fee: 300,
    membership_fee: 100, fee_receipt_number: 'F-1', handled_by_name: '王小姐',
    handled_on: '2026-08-17', handled_by_user_id: 'spoof', handled_by_account: 'spoof@example.com',
  }

  await expect(createStudentWithInitialEnrollment(client, profile, enrollment)).resolves.toEqual({
    student_id: 61,
    enrollment_id: 91,
  })
  expect(client.rpc).toHaveBeenCalledWith('create_student_with_initial_enrollment', {
    p_student: profile,
    p_enrollment: expect.not.objectContaining({
      handled_by_user_id: expect.anything(),
      handled_by_account: expect.anything(),
    }),
  })
})

it.each([
  ['PERIOD_DATES_REQUIRED', '請選擇開始日期與結束日期'],
  ['PERIOD_DATE_ORDER_INVALID', '結束日期不得早於開始日期'],
  ['FEE_AMOUNT_INVALID', '金額必須是 0 或正整數'],
  ['INITIAL_ENROLLMENT_CREATE_FORBIDDEN', '您沒有建立會員及報名的權限'],
])('maps %s to a stable message', async (databaseMessage, expectedMessage) => {
  const client = { rpc: vi.fn().mockResolvedValue({ data: null, error: new Error(databaseMessage) }) }
  await expect(createStudentWithInitialEnrollment(client, profile, {})).rejects.toThrow(expectedMessage)
})
```

Use the existing `profile` fixture. Add mappings for `PERIOD_INVALID`, `COURSE_REQUIRED`, `PERIOD_DATE_INVALID`, `HANDLED_ON_INVALID`, `AUTH_ACCOUNT_REQUIRED`, `INVALID_STUDENT_ID`, and `INVALID_BIRTH_DATE` in the same table-driven style.

- [ ] **Step 2: Run the service test and verify RED**

Run from `dashboard/`: `npm test -- src/services/studentService.test.js`

Expected: FAIL because `createStudentWithInitialEnrollment` is not exported.

- [ ] **Step 3: Implement the service function and mapping**

Add an explicit allow-list payload so actor fields cannot cross the service boundary:

```js
const INITIAL_ENROLLMENT_ERROR_MESSAGES = {
  INITIAL_ENROLLMENT_CREATE_FORBIDDEN: '您沒有建立會員及報名的權限',
  AUTH_ACCOUNT_REQUIRED: '無法取得目前登入帳號，請重新登入',
  PERIOD_INVALID: '請輸入有效期別，例如：第16期',
  PERIOD_DATES_REQUIRED: '請選擇開始日期與結束日期',
  PERIOD_DATE_INVALID: '日期格式不正確',
  PERIOD_DATE_ORDER_INVALID: '結束日期不得早於開始日期',
  COURSE_REQUIRED: '請至少選擇一門課程',
  FEE_AMOUNT_INVALID: '金額必須是 0 或正整數',
  HANDLED_ON_INVALID: '辦理日期格式不正確',
  INVALID_STUDENT_ID: '會員 ID 必須是大於 0 的整數',
  INVALID_BIRTH_DATE: '出生年月日格式不正確',
}

export async function createStudentWithInitialEnrollment(client, student, enrollment) {
  const pEnrollment = Object.fromEntries([
    'period', 'period_start_date', 'period_end_date', 'courses', 'notes',
    'prepaid_amount', 'prepaid_receipt_number', 'tuition_fee', 'materials_fee',
    'membership_fee', 'fee_receipt_number', 'handled_by_name', 'handled_on',
  ].map(key => [key, enrollment[key]]))

  const { data, error } = await client.rpc('create_student_with_initial_enrollment', {
    p_student: student,
    p_enrollment: pEnrollment,
  })
  if (error) {
    const mapped = INITIAL_ENROLLMENT_ERROR_MESSAGES[error.message]
    throw mapped ? new Error(mapped) : mapStudentMutationError(error)
  }
  return {
    student_id: Number(data.student_id),
    enrollment_id: Number(data.enrollment_id),
  }
}
```

- [ ] **Step 4: Run service tests and verify GREEN**

Run: `npm test -- src/services/studentService.test.js`

Expected: all member profile and combined-create service tests PASS.

- [ ] **Step 5: Commit the service unit**

```powershell
git add dashboard/src/services/studentService.js dashboard/src/services/studentService.test.js
git commit -m "feat: add combined member enrollment service"
```

---

### Task 5: Presentational Wizard Steps

**Files:**
- Create: `dashboard/src/components/students/MemberProfileStep.test.jsx`
- Create: `dashboard/src/components/students/MemberProfileStep.jsx`
- Create: `dashboard/src/components/students/InitialEnrollmentStep.test.jsx`
- Create: `dashboard/src/components/students/InitialEnrollmentStep.jsx`

**Interfaces:**
- Produces: `MemberProfileStep({profile,onChange,disabled})` and `InitialEnrollmentStep({enrollment,onChange,onCoursesChange,account,disabled})`.
- Consumes: `EDUCATION_OPTIONS` and existing `CourseTagPicker`.

- [ ] **Step 1: Write the failing member-step test**

Render a complete profile and assert the existing field contract remains intact:

```jsx
render(<MemberProfileStep profile={profile} onChange={vi.fn()} disabled={false} />)
expect(screen.getByLabelText('ID（選填）').required).toBe(false)
expect(screen.getByLabelText('姓名').required).toBe(true)
expect(screen.getByLabelText('性別').required).toBe(true)
expect(screen.getByLabelText('教育程度').required).toBe(true)
for (const label of ['電子郵件', '電話', '出生年月日', '通訊處', '服務機關 / 學校']) {
  expect(screen.getByLabelText(label)).not.toBeNull()
}
```

- [ ] **Step 2: Run the member-step test and verify RED**

Run: `npm test -- src/components/students/MemberProfileStep.test.jsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Move the existing profile field JSX into `MemberProfileStep`**

Use this presentational implementation, retaining the current IDs and field rules:

```jsx
import { EDUCATION_OPTIONS } from '../../domain/studentFields'

export default function MemberProfileStep({ profile, onChange, disabled = false }) {
  return <>
    <Field label="ID（選填）"><input id="student-id" className="form-input" name="student_id" inputMode="numeric" value={profile.student_id} onChange={onChange} disabled={disabled} /></Field>
    <Field label="姓名"><input id="student-name" className="form-input" name="name" value={profile.name} onChange={onChange} disabled={disabled} required /></Field>
    <Field label="性別"><select id="student-gender" className="form-select" name="gender" value={profile.gender} onChange={onChange} disabled={disabled} required><option value="">請選擇</option><option value="男">男</option><option value="女">女</option></select></Field>
    <Field label="電子郵件"><input id="student-email" className="form-input" name="email" type="email" value={profile.email} onChange={onChange} disabled={disabled} /></Field>
    <Field label="電話"><input id="student-phone" className="form-input" name="phone" value={profile.phone} onChange={onChange} disabled={disabled} /></Field>
    <Field label="出生年月日"><input id="student-birth-date" className="form-input" name="birth_date" type="date" value={profile.birth_date} onChange={onChange} disabled={disabled} /></Field>
    <Field label="通訊處"><input id="student-address" className="form-input" name="address" value={profile.address} onChange={onChange} disabled={disabled} /></Field>
    <Field label="服務機關 / 學校"><input id="student-organization" className="form-input" name="organization" value={profile.organization} onChange={onChange} disabled={disabled} /></Field>
    <Field label="教育程度"><select id="student-education" className="form-select" name="education" value={profile.education} onChange={onChange} disabled={disabled} required><option value="">請選擇</option>{EDUCATION_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}</select></Field>
  </>
}

function Field({ label, children }) {
  return <div className="form-group"><label className="form-label" htmlFor={children.props.id}>{label}</label>{children}</div>
}
```

Do not put state, Supabase imports, submit buttons, or navigation inside this component.

- [ ] **Step 4: Run the member-step test and verify GREEN**

Run: `npm test -- src/components/students/MemberProfileStep.test.jsx`

Expected: PASS.

- [ ] **Step 5: Write the failing enrollment-step test**

Mock `CourseTagPicker` as a button that calls `onChange(['肌力訓練'])`:

```jsx
vi.mock('../enrollment/CourseTagPicker', () => ({
  default: ({ onChange }) => <button type="button" onClick={() => onChange(['肌力訓練'])}>選擇肌力訓練</button>,
}))
```

Assert the exact labels and browser input semantics:

```jsx
render(
  <InitialEnrollmentStep
    enrollment={enrollment}
    onChange={vi.fn()}
    onCoursesChange={vi.fn()}
    account="editor@example.com"
    disabled={false}
  />,
)
for (const label of [
  '期別', '開始日期', '結束日期', '預繳金額', '預繳 No.',
  '學費', '教材費', '會友費', '正式收據 No.', '備註',
  '經手人姓名', '登入帳號（自動帶入）', '辦理日期',
]) expect(screen.getByLabelText(label)).not.toBeNull()
expect(screen.getByLabelText('開始日期').type).toBe('date')
expect(screen.getByLabelText('結束日期').type).toBe('date')
expect(screen.getByLabelText('辦理日期').type).toBe('date')
expect(screen.getByLabelText('登入帳號（自動帶入）').readOnly).toBe(true)
expect(screen.getByLabelText('登入帳號（自動帶入）').value).toBe('editor@example.com')
```

Also assert all four money inputs use `type="number"`, `min="0"`, and `step="1"`; only period/start/end are HTML-required; notes is a `<textarea>`; clicking the mocked course button calls `onCoursesChange`.

- [ ] **Step 6: Run the enrollment-step test and verify RED**

Run: `npm test -- src/components/students/InitialEnrollmentStep.test.jsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 7: Implement `InitialEnrollmentStep`**

Render the four approved groups and keep the account out of mutable form state:

```jsx
import CourseTagPicker from '../enrollment/CourseTagPicker'

export default function InitialEnrollmentStep({
  enrollment, onChange, onCoursesChange, account, disabled = false,
}) {
  const input = (id, name, type = 'text', extra = {}) => (
    <input id={id} className="form-input" name={name} type={type}
      value={enrollment[name] ?? ''} onChange={onChange} disabled={disabled} {...extra} />
  )
  const money = (id, name) => input(id, name, 'number', { min: '0', step: '1', inputMode: 'numeric' })
  return <>
    <fieldset className="member-wizard-section">
      <legend>報名資訊</legend>
      <div className="member-wizard-section-grid">
        <Field label="期別" id="initial-enrollment-period">{input('initial-enrollment-period', 'period', 'text', { required: true, placeholder: '例如：第16期' })}</Field>
        <Field label="開始日期" id="initial-enrollment-start">{input('initial-enrollment-start', 'period_start_date', 'date', { required: true })}</Field>
        <Field label="結束日期" id="initial-enrollment-end">{input('initial-enrollment-end', 'period_end_date', 'date', { required: true })}</Field>
        <div className="form-group full-width"><span className="form-label">報名課程</span><CourseTagPicker selectedCourseNames={enrollment.courses} lockedCourseNames={[]} onChange={onCoursesChange} disabled={disabled} /></div>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>預繳</legend>
      <div className="member-wizard-section-grid">
        <Field label="預繳金額" id="initial-enrollment-prepaid">{money('initial-enrollment-prepaid', 'prepaid_amount')}</Field>
        <Field label="預繳 No." id="initial-enrollment-prepaid-no">{input('initial-enrollment-prepaid-no', 'prepaid_receipt_number')}</Field>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>正式收費</legend>
      <div className="member-wizard-section-grid">
        <Field label="學費" id="initial-enrollment-tuition">{money('initial-enrollment-tuition', 'tuition_fee')}</Field>
        <Field label="教材費" id="initial-enrollment-materials">{money('initial-enrollment-materials', 'materials_fee')}</Field>
        <Field label="會友費" id="initial-enrollment-membership">{money('initial-enrollment-membership', 'membership_fee')}</Field>
        <Field label="正式收據 No." id="initial-enrollment-fee-no">{input('initial-enrollment-fee-no', 'fee_receipt_number')}</Field>
      </div>
    </fieldset>
    <fieldset className="member-wizard-section">
      <legend>經手資訊</legend>
      <div className="member-wizard-section-grid">
        <Field label="備註" id="initial-enrollment-notes" fullWidth><textarea id="initial-enrollment-notes" className="form-input form-textarea" name="notes" rows={3} value={enrollment.notes} onChange={onChange} disabled={disabled} /></Field>
        <Field label="經手人姓名" id="initial-enrollment-handler">{input('initial-enrollment-handler', 'handled_by_name')}</Field>
        <Field label="登入帳號（自動帶入）" id="initial-enrollment-account"><input id="initial-enrollment-account" className="form-input" value={account || ''} readOnly aria-readonly="true" /></Field>
        <Field label="辦理日期" id="initial-enrollment-handled-on">{input('initial-enrollment-handled-on', 'handled_on', 'date')}</Field>
      </div>
    </fieldset>
  </>
}

function Field({ label, id, fullWidth = false, children }) {
  return <div className={`form-group${fullWidth ? ' full-width' : ''}`}><label className="form-label" htmlFor={id}>{label}</label>{children}</div>
}
```

Do not put the account value into `enrollment` and do not call `onChange` for the read-only account.

- [ ] **Step 8: Run both presentational tests and verify GREEN**

Run:

```powershell
npm test -- src/components/students/MemberProfileStep.test.jsx src/components/students/InitialEnrollmentStep.test.jsx
```

Expected: both files PASS.

- [ ] **Step 9: Commit the presentational components**

```powershell
git add dashboard/src/components/students/MemberProfileStep.jsx dashboard/src/components/students/MemberProfileStep.test.jsx dashboard/src/components/students/InitialEnrollmentStep.jsx dashboard/src/components/students/InitialEnrollmentStep.test.jsx
git commit -m "feat: add member enrollment wizard steps"
```

---

### Task 6: Two-Step Add-Member Wizard Integration

**Files:**
- Modify: `dashboard/src/components/students/AddStudentModal.test.jsx`
- Modify: `dashboard/src/components/students/AddStudentModal.jsx`
- Modify: `dashboard/src/components/common/common.css`

**Interfaces:**
- Consumes: Task 1 `normalizeInitialEnrollmentForm`, Task 4 `createStudentWithInitialEnrollment`, Task 5 step components, `normalizeStudentId`, `useAuth().user.email`, and existing `onRefresh`/`onClose` callbacks.
- Produces: one accessible two-step modal that submits exactly once and closes only after RPC success.

- [ ] **Step 1: Replace the old modal test with failing wizard behavior tests**

Mock `useAuth` to return `{ user: { email: 'editor@example.com' } }`, mock the combined service, and mock `CourseTagPicker` with a deterministic selection button. Add a `completeProfile()` helper that fills name, gender, and education.

Write these separate tests:

1. Initial render says `步驟 1 / 2` and shows member fields but not `期別`.
2. Completing required profile fields and clicking `下一步` shows `步驟 2 / 2`, all enrollment fields, and the read-only account.
3. Entering a name, navigating forward then back preserves the name.
4. Missing dates, reversed dates, no course, and invalid amount each show the exact Task 1 message and do not call the service.
5. A valid submit sends normalized student and enrollment payloads; the payload has no actor ID/account.
6. Two submits while the returned promise is pending produce one service call and disabled controls.
7. Rejection shows the service message, keeps the dialog open, and calls neither callback.
8. Resolution calls `onRefresh` once and `onClose` once.

Use this successful flow assertion:

```jsx
fireEvent.change(screen.getByLabelText('期別'), { target: { value: '第16期' } })
fireEvent.change(screen.getByLabelText('開始日期'), { target: { value: '2026-09-01' } })
fireEvent.change(screen.getByLabelText('結束日期'), { target: { value: '2026-12-31' } })
fireEvent.click(screen.getByRole('button', { name: '選擇肌力訓練' }))
fireEvent.change(screen.getByLabelText('學費'), { target: { value: '2400' } })
fireEvent.click(screen.getByRole('button', { name: '新增會員及報名' }))

await waitFor(() => expect(createStudentWithInitialEnrollment).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({ name: '王小明', gender: '男', education: '高中' }),
  expect.objectContaining({
    period: '第16期', period_start_date: '2026-09-01', period_end_date: '2026-12-31',
    courses: ['肌力訓練'], tuition_fee: 2400,
  }),
))
```

- [ ] **Step 2: Run the modal test and verify RED**

Run: `npm test -- src/components/students/AddStudentModal.test.jsx`

Expected: FAIL because the current modal has no wizard, enrollment fields, auth account, or combined service call.

- [ ] **Step 3: Implement wizard state and profile normalization**

Replace the old `createStudent` import with these wizard dependencies:

```js
import { useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { normalizeInitialEnrollmentForm } from '../../domain/initialEnrollment'
import { normalizeStudentId } from '../../domain/studentIdentity'
import { supabase } from '../../lib/supabaseClient'
import { createStudentWithInitialEnrollment } from '../../services/studentService'
import InitialEnrollmentStep from './InitialEnrollmentStep'
import MemberProfileStep from './MemberProfileStep'
import '../common/common.css'
```

Use these state shapes:

```js
const initialProfile = {
  student_id: '', email: '', name: '', gender: '', phone: '', birth_date: '',
  address: '', organization: '', education: '',
}
const initialEnrollment = {
  period: '', period_start_date: '', period_end_date: '', courses: [], notes: '',
  prepaid_amount: '', prepaid_receipt_number: '', tuition_fee: '', materials_fee: '',
  membership_fee: '', fee_receipt_number: '', handled_by_name: '', handled_on: '',
}

const changeProfile = event => {
  const { name, value } = event.target
  setProfile(current => ({ ...current, [name]: value }))
}
const changeEnrollment = event => {
  const { name, value } = event.target
  setEnrollment(current => ({ ...current, [name]: value }))
}

function normalizeProfile(profile) {
  if (!profile.name.trim() || !profile.gender || !profile.education) {
    throw new Error('請填寫姓名、性別與教育程度')
  }
  const payload = Object.fromEntries(
    Object.entries(profile).map(([key, value]) => [key, String(value).trim()]),
  )
  payload.student_id = payload.student_id ? normalizeStudentId(payload.student_id) : null
  payload.email = payload.email.toLowerCase() || null
  for (const key of ['phone', 'birth_date', 'address', 'organization']) payload[key] ||= null
  return payload
}
```

Track `step`, `profile`, `enrollment`, `error`, and `isSubmitting`; use a `submitInFlightRef` to synchronously reject duplicate submits. Read `{ user } = useAuth()` only for displaying `user?.email || ''`.

- [ ] **Step 4: Implement navigation and atomic submit**

The form submit handler routes step one to validation/navigation and step two to the RPC:

```js
const handleSubmit = async event => {
  event.preventDefault()
  setError('')
  if (step === 1) {
    try {
      normalizeProfile(profile)
      setStep(2)
    } catch (validationError) {
      setError(validationError.message)
    }
    return
  }
  if (submitInFlightRef.current) return

  let succeeded = false
  try {
    const studentPayload = normalizeProfile(profile)
    const enrollmentPayload = normalizeInitialEnrollmentForm(enrollment)
    submitInFlightRef.current = true
    setIsSubmitting(true)
    await createStudentWithInitialEnrollment(supabase, studentPayload, enrollmentPayload)
    succeeded = true
  } catch (submitError) {
    setError(submitError.message || '新增會員及報名失敗')
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

Render the modal with one form and disable every exit/navigation control while pending:

```jsx
return <div className="modal-overlay-center" onClick={isSubmitting ? undefined : onClose} id="modal-add-student-overlay">
  <div className="form-modal-content" role="dialog" aria-modal="true" aria-labelledby="add-member-title" onClick={event => event.stopPropagation()}>
    <div className="modal-header-centered">
      <h2 id="add-member-title">新增會員與首筆報名</h2>
      <button type="button" className="btn-close" onClick={isSubmitting ? undefined : onClose} disabled={isSubmitting} aria-label="關閉新增會員"><X size={20} /></button>
    </div>
    <form onSubmit={handleSubmit} className="form-grid">
      <p className="member-wizard-progress">步驟 {step} / 2</p>
      {step === 1
        ? <MemberProfileStep profile={profile} onChange={changeProfile} disabled={isSubmitting} />
        : <InitialEnrollmentStep enrollment={enrollment} onChange={changeEnrollment} onCoursesChange={courses => setEnrollment(current => ({ ...current, courses }))} account={user?.email || ''} disabled={isSubmitting} />}
      {error && <p className="student-edit-error" role="alert">{error}</p>}
      <div className="form-footer full-width">
        {step === 2 && <button type="button" className="btn-secondary" onClick={() => { setError(''); setStep(1) }} disabled={isSubmitting}>上一步</button>}
        <button type="button" className="btn-secondary" onClick={isSubmitting ? undefined : onClose} disabled={isSubmitting}>取消</button>
        <button type="submit" className="btn-primary" disabled={isSubmitting}>{step === 1 ? '下一步' : '新增會員及報名'}</button>
      </div>
    </form>
  </div>
</div>
```

Define `changeProfile` and `changeEnrollment` as functional state updates keyed by `event.target.name` so navigating back never loses values.

- [ ] **Step 5: Add minimal wizard styling**

Append focused styles to `common.css`:

```css
.member-wizard-progress { grid-column: 1 / -1; margin: 0 0 16px; color: var(--text-secondary); font-size: 0.875rem; }
.member-wizard-section { grid-column: 1 / -1; border: 0; padding: 0; margin: 0; }
.member-wizard-section + .member-wizard-section { margin-top: 8px; padding-top: 16px; border-top: 1px solid var(--border-color); }
.member-wizard-section legend { margin-bottom: 12px; font-weight: 700; }
.member-wizard-section-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.form-textarea { min-height: 84px; resize: vertical; }
@media (max-width: 640px) { .member-wizard-section-grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 6: Run modal and presentational tests and verify GREEN**

Run:

```powershell
npm test -- src/components/students/AddStudentModal.test.jsx src/components/students/MemberProfileStep.test.jsx src/components/students/InitialEnrollmentStep.test.jsx
```

Expected: all wizard tests PASS without React `act` warnings or console errors.

- [ ] **Step 7: Run affected frontend regressions**

Run:

```powershell
npm test -- src/App.test.jsx src/components/students/StudentListTab.test.jsx src/services/studentService.test.js src/domain/initialEnrollment.test.js
```

Expected: all affected app, list, service, and domain tests PASS.

- [ ] **Step 8: Commit the wizard integration**

```powershell
git add dashboard/src/components/students/AddStudentModal.jsx dashboard/src/components/students/AddStudentModal.test.jsx dashboard/src/components/common/common.css
git commit -m "feat: add member enrollment wizard"
```

---

### Task 7: Full Verification and Requirement Audit

**Files:**
- Verify only; modify the failing unit's test or implementation if fresh evidence finds a defect.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: fresh proof that the complete feature satisfies the approved design without regressions.

- [ ] **Step 1: Run all database checks**

From the repository root:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db
.\node_modules\.bin\supabase.cmd migration list --local
```

Expected: reset succeeds, every pgTAP file passes, and both new migrations appear in the local migration list in timestamp order.

- [ ] **Step 2: Run all frontend checks**

From `dashboard/`:

```powershell
npm test
npm run lint
npm run build
```

Expected: zero failed tests, zero lint errors, and Vite build exit code 0.

- [ ] **Step 3: Run repository hygiene checks**

From the repository root:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors. The unrelated root `App.jsx` and `AuthContext.jsx` may remain untracked and must not be staged; feature files must be committed.

- [ ] **Step 4: Audit every acceptance criterion against evidence**

Confirm each item by pointing to a passing test:

- Two-step member/initial-enrollment navigation and state retention.
- Date-picker types, required period/dates/course, date ordering, and nonnegative integer fees.
- Independent prepaid No. and shared formal fee No.
- Free handler name plus read-only login account.
- Server-derived actor UUID/email despite spoofed payload.
- One service call, one refresh, one close, and no close on error.
- Atomic rollback leaves no member when course insertion fails.
- Viewer/anon denial and authenticated execute grant.
- Existing historical enrollments and existing frontend/database suites remain green.

- [ ] **Step 5: Apply verification-before-completion**

Read the complete fresh outputs from Steps 1–3. If any check fails, report the actual failure, add a focused failing regression test, fix only that defect, rerun the targeted check, then rerun Steps 1–3 in full. Make no completion claim until all outputs are green.
