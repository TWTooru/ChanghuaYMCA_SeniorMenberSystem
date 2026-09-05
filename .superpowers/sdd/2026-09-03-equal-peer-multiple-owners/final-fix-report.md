# Final-fix report — Equal-peer multiple owners

Date: 2026-09-06

## Outcome

Both final-review blockers are addressed without changing the equal-peer owner
policy or weakening the PostgreSQL last-owner trigger.

## Root causes and fixes

1. The delete handler guarded its Auth-error recheck with the role loaded before
   deletion. If that stale role was not `owner`, a failed Auth deletion never
   re-read the target role or owner count. The handler now performs the fresh,
   concurrent role/count recheck after every `deleteUser` failure. A still-present
   sole owner is returned and audited as `LAST_OWNER_REQUIRED` (HTTP 409), including
   when the initial role was `viewer` and changed to `owner` before the failure.

2. Role-update authorization and its database write were separated by a race
   window. `HandlerDeps.updateRole` now carries the authorized `expectedRole`, and
   the adapter includes it in the same filtered PostgreSQL `UPDATE` as the
   mutation (`user_id` plus current `role`). A changed target produces no row and
   fails closed as `ROLE_STORE_ERROR`; the pending audit is completed as failure.

3. Auth Admin deletion cannot include a PostgreSQL role predicate. The adapter
   therefore reserves deletion with one atomic, filtered `DELETE ... RETURNING`
   against `app_user_roles` using both `user_id` and `expectedRole`. Only after
   that succeeds does it call Auth Admin. The absent role row prevents a competing
   account-role mutation from authorizing or promoting the target. On any Auth
   failure, the adapter restores the exact saved role row, including its original
   `created_at` and `updated_at`, before propagating the Auth error for the handler's
   fresh last-owner recheck. A reservation miss never calls Auth Admin.

The reservation's role-row deletion still executes
`private.maintain_owner_invariant()`, so the database remains the authoritative
last-owner guard. Owner-to-owner update and deletion capabilities remain covered
by the handler/domain suites.

## TDD evidence

The new tests were added before the production interface changes. The RED check:

```text
deno test --no-run supabase/functions/admin-users/handler_test.ts supabase/functions/admin-users/index_test.ts
TS2554: Expected 2 arguments, but got 3 (updateRole expected-role contract)
TS2554: Expected 1 arguments, but got 2 (three deleteUser reservation cases)
Found 4 errors.
```

Deterministic regressions cover:

- a stale initially non-owner target becoming the sole owner before an Auth
  deletion failure and receiving audited `LAST_OWNER_REQUIRED`;
- an ordinary admin's role update losing a race to owner promotion without
  overwriting the owner;
- an ordinary admin's delete losing the same race without deleting the account;
- the exact adapter update predicate;
- delete reservation before Auth, restoration after Auth failure, and no Auth
  call on a reservation miss.

## Verification

- `deno test --no-run supabase/functions` — PASS (all Edge modules type-check).
- `deno test supabase/functions` — PASS outside the Windows sandbox: 78 passed,
  0 failed.
- Focused handler/adapter run — PASS: 55 passed, 0 failed.

### Windows Deno runner note

Inside the managed Windows sandbox, Deno 2.9.4 panicked before executing tests
because its named test-worker pipe returned access denied
(`Unexpected client pipe failure ... os error 5`). Clearing `SSLKEYLOGFILE` did
not make sandboxed worker creation viable. Running the same commands through the
approved unsandboxed `deno test` prefix succeeded; therefore this was a runner
environment restriction, not a test or implementation failure.

## Scope

Changed only the admin-users handler/adapter and their tests, plus this report.
No migration, remote database mutation, Edge deployment, Auth deletion, or email
action was performed.
