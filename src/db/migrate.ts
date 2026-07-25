import "../config/load-env.js";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import type { Database } from "./client.js";

const MIGRATIONS_FOLDER = new URL("./migrations", import.meta.url).pathname;

/**
 * Applies all pending migrations. Usable both as a CLI entry point
 * (`pnpm db:migrate`) and, in spirit, as the release step that runs
 * before the app boots (architecture §8, §10 — migrations run as a
 * release step, never on boot from multiple replicas).
 */
export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}

/**
 * Counts pending migrations without applying them. Building block for
 * the boot-time "assert no pending migrations" check (data model §6,
 * architecture §8). Actual wiring into app boot happens in B2 — this
 * function is the piece B1 owns.
 *
 * Drizzle doesn't expose a public "dry run" API, so this mirrors its
 * internal bookkeeping: it reads the migration journal, ensures the
 * `drizzle.__drizzle_migrations` table exists, and diffs applied hashes
 * against the journal's entries.
 */
export async function countPendingMigrations(db: Database): Promise<number> {
  const journalUrl = new URL("./migrations/meta/_journal.json", import.meta.url);
  const { readFile } = await import("node:fs/promises");
  const journalRaw = await readFile(journalUrl, "utf-8").catch(() => null);
  if (!journalRaw) return 0;

  const journal = JSON.parse(journalRaw) as { entries: Array<{ tag: string }> };
  const totalMigrations = journal.entries.length;
  if (totalMigrations === 0) return 0;

  const appliedResult = await db.execute<{ count: string }>(
    `select count(*)::text as count
       from information_schema.tables
      where table_schema = 'drizzle' and table_name = '__drizzle_migrations'`,
  );
  const migrationsTableExists = appliedResult.rows[0]?.count !== "0";
  if (!migrationsTableExists) return totalMigrations;

  const appliedCountResult = await db.execute<{ count: string }>(
    `select count(*)::text as count from drizzle.__drizzle_migrations`,
  );
  const appliedCount = Number.parseInt(appliedCountResult.rows[0]?.count ?? "0", 10);
  return Math.max(totalMigrations - appliedCount, 0);
}

/**
 * Boot-time guard (data model §6: "The app checks for pending migrations
 * at boot and refuses to start if any exist"). Wiring this into
 * index.ts's boot sequence is B2's job; B1 delivers the check itself.
 */
export async function assertNoPendingMigrations(db: Database): Promise<void> {
  const pending = await countPendingMigrations(db);
  if (pending > 0) {
    throw new Error(
      `${pending} pending migration(s) found. Run "pnpm db:migrate" before starting the app.`,
    );
  }
}

async function main(): Promise<void> {
  const connectionString =
    process.env["DATABASE_URL"] ?? "postgres://adopta:adopta@localhost:5432/adopta";
  const pool = new Pool({ connectionString });
  const db = drizzle(pool);
  try {
    await runMigrations(db as unknown as Database);

    console.log("Migrations applied successfully.");
  } finally {
    await pool.end();
  }
}

const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main().catch((err: unknown) => {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  });
}
