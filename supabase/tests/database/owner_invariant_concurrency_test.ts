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
const raceFixtureIds = [ownerA, ownerB];

type DatabaseClient = InstanceType<typeof Client>;

async function removeRaceFixtures(client: DatabaseClient) {
  await client.query("begin");

  try {
    await client.query(
      "lock table public.app_user_roles in access exclusive mode",
    );
    await client.query(
      "alter table public.app_user_roles disable trigger maintain_owner_invariant_after_change",
    );
    await client.query(
      "delete from auth.users where id = any($1::uuid[])",
      [raceFixtureIds],
    );
    await client.query(`
      update private.owner_invariant
      set owner_count = (
        select count(*)::integer
        from public.app_user_roles
        where role = 'owner'
      )
      where singleton is true
    `);
    await client.query(
      "alter table public.app_user_roles enable trigger maintain_owner_invariant_after_change",
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  }
}

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
         values ($1, 'owner-a@example.com', '{}', '{}')
         on conflict (id) do nothing`,
        [ownerA],
      );
      await setup.query(
        `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
         values ($1, 'owner-b@example.com', '{}', '{}')
         on conflict (id) do nothing`,
        [ownerB],
      );
      await setup.query(
        `update public.app_user_roles set role = 'owner' where user_id = $1`,
        [ownerA],
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
      let cleanupError: unknown;
      try {
        await removeRaceFixtures(setup);
      } catch (error) {
        cleanupError = error;
      }
      await Promise.allSettled([setup.end(), first.end(), second.end()]);
      if (cleanupError) throw cleanupError;
    }
  },
});

Deno.test("owner race fixtures are removed after the concurrency check", async () => {
  const verification = new Client({ connectionString: databaseUrl });
  await verification.connect();

  try {
    const result = await verification.query(
      `select count(*)::integer as fixture_count
       from auth.users
       where id = any($1::uuid[])`,
      [raceFixtureIds],
    );

    assertEquals(result.rows[0], { fixture_count: 0 });
  } finally {
    await verification.end();
  }
});
