import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('role based RLS migration', () => {
  it('does not use user-controlled metadata for app roles', () => {
    const migration = readFileSync(
      resolve(process.cwd(), '..', 'supabase', 'migrations', '20260709000000_role_based_rls.sql'),
      'utf8'
    )

    expect(migration).toContain("auth.jwt() -> 'app_metadata' ->> 'app_role'")
    expect(migration).not.toContain('user_metadata')
  })
})
