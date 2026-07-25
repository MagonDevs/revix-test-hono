import "./config/load-env.js";

import { serve } from "@hono/node-server";
import { env } from "./config/env.js";
import { db, closeDb } from "./db/client.js";
import { assertNoPendingMigrations } from "./db/migrate.js";
import { app } from "./http/app.js";
import { rootLogger } from "./lib/logger.js";

// Entry point: parse env (module-load side effect of config/env.ts) →
// assert no pending migrations → serve. Migrations themselves run as a
// release step (architecture §8), never on boot.

async function main(): Promise<void> {
  await assertNoPendingMigrations(db);

  const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
    rootLogger.info({ port: info.port }, "server.listening");
  });

  const shutdown = async (signal: string): Promise<void> => {
    rootLogger.info({ signal }, "server.shutting_down");
    server.close();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  rootLogger.error({ err }, "server.boot_failed");
  process.exitCode = 1;
});
