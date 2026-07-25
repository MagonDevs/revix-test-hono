import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDb, withRollback, type TestDb } from "./testcontainers-setup.js";
import type { Transaction } from "../types.js";

// Smoke test for the harness itself (build plan B1 item 11): start a
// real Postgres container, apply migrations, run a trivial query, roll
// back a transaction. Requires Docker. Run via `pnpm test:integration`;
// excluded from the default `pnpm test` run.

let testDb: TestDb;

describe("testcontainers harness", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("migrates and runs a trivial query", async () => {
    const result = await testDb.db.execute(sql`select 1 as one`);
    expect(result.rows[0]).toEqual({ one: 1 });
  });

  it("rolls back writes made inside withRollback", async () => {
    const before = await testDb.db.execute(sql`select count(*)::int as count from "user"`);

    await withRollback(testDb.db, async (tx: Transaction) => {
      await tx.execute(
        sql`insert into "user" (id, name, email, city)
            values ('smoke-test-user', 'Smoke Test', 'smoke@example.com', 'Madrid')`,
      );
    });

    const after = await testDb.db.execute(sql`select count(*)::int as count from "user"`);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });
});
