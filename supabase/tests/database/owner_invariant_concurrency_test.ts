import pg from "npm:pg@8.16.3";
import { assertEquals, assertMatch } from "jsr:@std/assert";

const { Client } = pg;
const databaseUrl = Deno.env.get("LOCAL_SUPABASE_DB_URL") ??
  "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const mode = Deno.env.get("OWNER_RACE_MODE");

if (mode !== "role" && mode !== "cascade") {
  throw new Error("OWNER_RACE_MODE must be role or cascade");
}

const ownerA = "20000000-0000-4000-8000-000000000001";
const ownerB = "20000000-0000-4000-8000-000000000002";

Deno.test({
  name: `owner invariant serializes the ${mode} race`,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const setup = new Client({ connectionString: databaseUrl });
    const first = new Client({ connectionString: databaseUrl });
    const second = new Client({ connectionString: databaseUrl });

    await setup.connect();
    await first.connect();
    await second.connect();

    try {
      await setup.query(
        `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
         values ($1, 'owner-a@example.com', '{}', '{}')`,
        [ownerA],
      );
      await setup.query(
        `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
         values ($1, 'owner-b@example.com', '{}', '{}')`,
        [ownerB],
      );
      await setup.query(
        `update public.app_user_roles set role = 'owner' where user_id = $1`,
        [ownerB],
      );

      await first.query("begin");
      await second.query("begin");
      await first.query(
        `update public.app_user_roles set role = 'viewer' where user_id = $1`,
        [ownerB],
      );

      const competingSql = mode === "role"
        ? `update public.app_user_roles set role = 'viewer' where user_id = $1`
        : `delete from auth.users where id = $1`;
      const competingResult = second.query(competingSql, [ownerA]).then(
        () => null,
        (error: unknown) => error as Error,
      );

      await new Promise((resolve) => setTimeout(resolve, 100));
      await first.query("commit");

      const competingError = await competingResult;
      assertMatch(competingError?.message ?? "", /LAST_OWNER_REQUIRED/);
      await second.query("rollback");

      const result = await setup.query(`
        select
          (select count(*)::integer
           from public.app_user_roles
           where role = 'owner') as actual_count,
          (select owner_count
           from private.owner_invariant
           where singleton is true) as guarded_count
      `);
      assertEquals(result.rows[0], { actual_count: 1, guarded_count: 1 });
    } finally {
      await first.query("rollback").catch(() => undefined);
      await second.query("rollback").catch(() => undefined);
      await Promise.allSettled([setup.end(), first.end(), second.end()]);
    }
  },
});
