import "../config/load-env.js";

import { LocalStorageAdapter } from "../adapters/local-storage.adapter.js";
import { env } from "../config/env.js";
import { closeDb, db } from "../db/client.js";
import { deleteById, findUnconsumedOlderThan } from "../modules/uploads/index.js";

// Architecture §7 / build-plan B6 — `pnpm sweep:uploads`. Deletes
// unreferenced (never attached to a pet, `consumed_at IS NULL`) uploads
// older than 24 hours. Scheduling this is a deployment concern (cron,
// not an in-app scheduler) — this script is just the logic + a wired
// package.json entry point.

const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

async function main(): Promise<void> {
  const storage = new LocalStorageAdapter(env.STORAGE_LOCAL_DIR);
  const cutoff = new Date(Date.now() - STALE_AFTER_MS);

  const stale = await findUnconsumedOlderThan(db, cutoff);

  let deleted = 0;
  for (const upload of stale) {
    await storage.delete(upload.storageKey);
    await deleteById(db, upload.id);
    deleted += 1;
  }

  console.log(`sweep-uploads: deleted ${deleted} unreferenced upload(s) older than 24h`);
}

main()
  .then(() => closeDb())
  .catch(async (err: unknown) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });
