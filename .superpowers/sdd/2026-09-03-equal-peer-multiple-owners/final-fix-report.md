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

## Durable-reservation review fix (2026-09-06)

This section supersedes item 3 and the original scope statement above. The
filtered `DELETE ... RETURNING` reservation was rejected in follow-up review:
although its normal Auth-error path restored the row, worker termination or a
failed restoration could permanently remove the authoritative role.

The replacement is a forward-only, CLI-created migration,
`20260905172646_add_durable_user_deletion_reservations.sql`, plus a
non-destructive adapter protocol:

- `reserve_app_user_deletion` locks the target role row, verifies the authorized
  `expected_role`, and creates or takes over a short-lived tokenized lease in
  `app_user_deletion_reservations`. It never deletes or rewrites the role row.
- A hardened trigger rejects role changes while the lease is active. This makes
  the role snapshot check and the competing role mutation serialize on the same
  row lock.
- The same trigger rejects an Auth cascade when its durable reservation is
  expired, released, or no longer matches the target role. Thus a worker that
  resumes after its lease expires cannot perform its stale deletion.
- On an Auth failure, `release_app_user_deletion` marks the reservation released
  instead of deleting it. Role management is immediately unblocked, while the
  durable marker continues to fence a resumed stale worker. A later authorized
  request can atomically take over that released marker.
- If the worker terminates or release storage fails, the role remains intact.
  The active lease expires after two minutes; it then permits role management
  and can be replaced by a new authorized deletion request, while the expired
  marker itself continues to reject the old Auth cascade.
- A successful Auth deletion cascades through the still-present role row and
  reservation row. The existing `private.maintain_owner_invariant()` trigger
  remains the authoritative last-owner check, and owner-peer deletion is still
  allowed whenever another owner remains.

The reservation table has RLS enabled. `anon` and `authenticated` have no table
or RPC access; only `service_role` can execute the two security-invoker RPCs.
The enforcement function is a hardened, trigger-only security-definer function
in `private`.

### Follow-up TDD evidence

Before replacing the destructive adapter, the focused adapter suite failed as
expected: 24 passed and 3 failed. The failures showed that the old code tried to
call `.from('app_user_roles').delete()` instead of the reservation RPC, could not
release the durable token on Auth failure, and had no fail-closed recovery path.

New deterministic adapter and pgTAP cases cover:

- no destructive role-table operation before Auth;
- reserve miss/storage failure never calling Auth;
- token-preserving release after Auth failure, including release error and
  rejected-release handling;
- exact mapping of expired/stale cascade rejection;
- service-role-only RPC/table hardening;
- expected-role mismatch, active-lease role mutation rejection, role-row
  survival across failed recovery, released-marker fencing, expiration,
  takeover, and stale-token rejection;
- successful viewer deletion, non-last owner-peer deletion, and final-owner
  rejection through the unchanged PostgreSQL invariant.

### Follow-up verification

- Focused `deno test` for `admin-users/index_test.ts` and
  `admin-users/handler_test.ts`: PASS, 59 passed and 0 failed.
- Full `deno test supabase/functions`: PASS outside the managed Windows sandbox,
  82 passed and 0 failed.
- Managed-sandbox Deno remains blocked before test execution by Deno 2.9.4's
  named-pipe access error (`os error 5`); the same suite passes through the
  approved unsandboxed `deno test` command.
- Database migration replay and pgTAP execution are blocked locally because the
  Docker Desktop Linux engine pipe does not exist. `supabase status` failed with
  `open //./pipe/dockerDesktopLinuxEngine: The system cannot find the file
  specified.` The database tests above are committed but are not reported as
  executed or passing.
- Focused `deno lint` is still non-zero because this pre-existing Edge suite does
  not follow the repository's current Deno lint/format defaults (inline import
  prefixes, explicit `any`, test fake `require-await`, quote/semicolon style).
  No bulk style rewrite was performed in this security fix.

No remote migration, Edge deployment, Auth deletion, email action, or other
external mutation was performed.
