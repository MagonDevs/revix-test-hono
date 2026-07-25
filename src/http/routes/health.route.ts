import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { Database } from "../../db/types.js";

export function createHealthRoutes(db: Database): Hono {
  const health = new Hono();

  health.get("/health", (c) => c.json({ status: "ok" }, 200));

  health.get("/ready", async (c) => {
    try {
      await db.execute(sql`select 1`);
      return c.json({ status: "ok" }, 200);
    } catch {
      return c.json({ status: "unavailable" }, 503);
    }
  });

  return health;
}
