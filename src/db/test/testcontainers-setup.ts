import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { runMigrations } from "../migrate.js";
import * as schema from "../schema/index.js";
import type { Database, Transaction } from "../types.js";

export interface TestDb {
  container: StartedPostgreSqlContainer;
  pool: Pool;
  db: Database;
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

export { sql };
