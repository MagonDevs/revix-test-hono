import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

// B9: consumes the parsed, boot-validated `env` (config/env.ts) instead of
// reading `process.env` directly, so `DATABASE_POOL_MAX` (and every other
// var) fails boot the same way everywhere else does rather than silently
// falling back to a default in production.

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX });

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
