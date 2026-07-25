import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../config/env.js";
import * as schema from "./schema/index.js";

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: env.DATABASE_POOL_MAX });

export const db = drizzle(pool, { schema });

export type Database = typeof db;

export async function closeDb(): Promise<void> {
  await pool.end();
}
