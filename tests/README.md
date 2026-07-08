# Legacy Python Tests

The tests in this directory target the previous Flask/SQLite backend.
That backend is no longer the active runtime path for the dashboard.

Current frontend and Supabase-facing behavior should be verified with the
Vitest suite under `dashboard/src`. Do not treat this pytest suite as current
architecture verification until the tests are rewritten for the active stack.
