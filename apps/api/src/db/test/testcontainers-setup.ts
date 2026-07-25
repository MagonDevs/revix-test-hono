import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { runMigrations } from "../migrate.js";
import * as schema from "../schema/index.js";
import type { Database, Transaction } from "../types.js";

// Architecture §9: "one Testcontainers Postgres per test file group,
// migrations applied once, and each test wrapped in a transaction that
// is rolled back." This module is that harness. It requires a running
// Docker daemon; if Docker isn't available, starting the container
// throws and callers should skip the suite (see the smoke test for the
// pattern).

export interface TestDb {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: Database;
  /** Tears down the pool and the container. Call once per test file, in afterAll. */
  teardown: () => Promise<void>;
}

export async function startTestDb(): Promise<TestDb> {
  const container = await new PostgreSqlContainer("postgres:16")
    .withDatabase("adopta_test")
    .withUsername("adopta")
    .withPassword("adopta")
    .start();

  const pool = new Pool({ connectionString: container.getConnectionUri() });
  const db = drizzle(pool, { schema });

  // pg_trgm / pgcrypto are enabled by the first migration itself, so a
  // plain runMigrations() is sufficient here.
  await runMigrations(db);

  return {
    container,
    pool,
    db,
    teardown: async () => {
      await pool.end();
      await container.stop();
    },
  };
}

/**
 * Runs `fn` inside a transaction that is always rolled back, so tests
 * never leak state into one another regardless of pass/fail. Drizzle
 * doesn't expose "force rollback," so this throws a sentinel after `fn`
 * completes and swallows only that sentinel.
 */
class RollbackSentinel extends Error {}

export async function withRollback<T>(
  db: Database,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  let result!: T;
  try {
    await db.transaction(async (tx: Transaction) => {
      result = await fn(tx);
      throw new RollbackSentinel();
    });
  } catch (err) {
    if (!(err instanceof RollbackSentinel)) throw err;
  }
  return result;
}

/** Re-exported for the smoke test's trivial query. */
export { sql };
