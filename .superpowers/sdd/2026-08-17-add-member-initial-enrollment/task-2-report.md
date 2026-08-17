# Task 2 Report: Enrollment Paper-Form Columns and Constraints

## Scope delivered

- Added thirteen nullable columns to `public.enrollments`.
- Added the five required named `CHECK` constraints.
- Added the transaction-wrapped 19-assertion pgTAP schema test.
- No foreign key to `auth.users`, no index, and no changes to billing receipts or RPCs.
- Existing rows remain compatible because every new column is nullable and every new check explicitly permits `NULL`.

## Current documentation consulted

- Supabase changelog: https://supabase.com/changelog.md (fetched 2026-08-17). Relevant recent breaking changes concern the Management API logs endpoint, extension version pinning, public-table API exposure, and GraphQL; none changes this imperative migration, pgTAP, function, grants, or RLS workflow.
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security (reviewed existing-table RLS guidance; this task alters an existing RLS-enabled table and creates no policy).
- Supabase Database Functions: https://supabase.com/docs/guides/database/functions (reviewed function security/privilege guidance; this task intentionally changes no function or grant).
- Supabase Advanced pgTAP Testing: https://supabase.com/docs/guides/local-development/testing/pgtap-extended (reviewed transaction-wrapped pgTAP test structure).
- Supabase Postgres best-practice references consulted locally: `schema-constraints.md`, `schema-data-types.md`, and `schema-foreign-key-indexes.md`.

## CLI discovery

Commands run from the repository root:

```powershell
.\node_modules\.bin\supabase.cmd --version
.\node_modules\.bin\supabase.cmd migration new --help
.\node_modules\.bin\supabase.cmd test db --help
```

- Version reported: `2.109.1`.
- `migration new` documents `supabase migration new [flags] <migration name>`.
- `test db` documents `supabase test db [flags] <path...>`.

## TDD evidence

### RED

Created `supabase/tests/database/initial_enrollment_fields_test.sql` first, with `select plan(19);`: thirteen `col_type_is` assertions, one valid insert, and five constraint-rejection assertions.

Command:

```powershell
.\node_modules\.bin\supabase.cmd test db supabase/tests/database/initial_enrollment_fields_test.sql
```

Result: the CLI attempted the local database connection and failed before pgTAP could execute:

```text
LegacyDbConnectError: failed to connect to postgres: effect/sql/SqlError: PgClient: Failed to connect
Connecting to local database...
```

Therefore the expected missing-column assertion failures could not be observed.

### GREEN

Generated the migration with the CLI:

```powershell
.\node_modules\.bin\supabase.cmd migration new add_member_initial_enrollment_fields
```

Exact migration filename: `supabase/migrations/20260817090742_add_member_initial_enrollment_fields.sql`.

The migration adds all required nullable columns and exactly these named checks:

- `enrollments_period_dates_order_check`
- `enrollments_prepaid_amount_nonnegative`
- `enrollments_tuition_fee_nonnegative`
- `enrollments_materials_fee_nonnegative`
- `enrollments_membership_fee_nonnegative`

GREEN command attempted:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db supabase/tests/database/initial_enrollment_fields_test.sql
```

`db reset` could not start/inspect the local stack, so the follow-up pgTAP run was not possible. Exact reset blocker:

```text
failed to inspect service: error during connect: Get "http://%2F%2F.%2Fpipe%2FdockerDesktopLinuxEngine/v1.51/containers/supabase_db_work2/json": open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.
Docker Desktop is a prerequisite for local development.
```

Independent `docker version` confirmation showed the Docker client is installed (`29.7.2`, context `desktop-linux`), but failed to connect to the same absent daemon pipe.

## Database test result

Not executable in this environment: local Docker Desktop's Linux daemon is not running/available. No pgTAP assertion count can be claimed. Once Docker Desktop is running, run:

```powershell
.\node_modules\.bin\supabase.cmd db reset
.\node_modules\.bin\supabase.cmd test db supabase/tests/database/initial_enrollment_fields_test.sql
```

Expected result: `19/19` assertions pass.

## Static verification

- `git diff --cached --check` exited 0 before commit.
- A post-change scope inspection confirmed `plan(19)`, all thirteen `add column` clauses, and all five required constraint names.
- The migration contains no `references auth.users`, `create index`, `create or replace function`, or `billing_receipts` text.

## Files changed

- `supabase/migrations/20260817090742_add_member_initial_enrollment_fields.sql`
- `supabase/tests/database/initial_enrollment_fields_test.sql`

## Commit

- `6d1e9a4 feat: store enrollment form details`

## Self-review

- Confirmed all columns are nullable, preserving historical enrollment rows.
- Confirmed each monetary check accepts `NULL` and rejects values below zero.
- Confirmed the date-order check permits partial dates and rejects only reversed non-null dates.
- Confirmed `handled_by_user_id` is an unconstrained `uuid` audit snapshot, intentionally not an Auth foreign key.
- Confirmed no out-of-scope table, RPC, privilege, RLS, or index change was included.

## Concerns

- Database RED/GREEN evidence is blocked solely by the unavailable Docker Desktop Linux daemon. Run the two commands above after starting Docker Desktop before merging.
- `package-lock.json` was already modified in the worktree and was intentionally left unstaged and outside this commit.

## Review-fix round 1

- Updated the pgTAP student fixture to schema-valid values: `gender = '女'`, `education = '高中'`.
- Kept the valid enrollment at `第1期`, then assigned `第2期` through `第6期` to the reversed-date and four negative-fee assertions. This prevents the `(student_id, period)` unique constraint from masking any intended check-constraint failure.
- Static inspection verified the five rejection inserts use five distinct periods and `git diff --check` completed successfully. Database runtime verification remains blocked by the unavailable Docker Desktop Linux daemon.
- Re-ran `supabase test db supabase/tests/database/initial_enrollment_fields_test.sql` after this fix; it again failed before pgTAP execution with `LegacyDbConnectError: PgClient: Failed to connect`.
