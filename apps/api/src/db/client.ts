import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

// B1 note: env parsing is minimal and reads process.env directly with
// sane defaults. B2's config/env.ts will formalise this with zod
// validation (architecture §8) and this client should switch to
// consuming the parsed `env` object at that point.

const connectionString =
  process.env["DATABASE_URL"] ?? "postgres://adopta:adopta@localhost:5432/adopta";
const max = Number.parseInt(process.env["DATABASE_POOL_MAX"] ?? "10", 10);

export const pool = new Pool({ connectionString, max });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

/**
 * Graceful shutdown: stop accepting new work and let in-flight queries
 * drain before closing the pool. Intended to be called from the
 * process's SIGTERM/SIGINT handler (wired up in B2's index.ts).
 */
export async function closeDb(): Promise<void> {
  await pool.end();
}
