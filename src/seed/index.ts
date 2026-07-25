import "../config/load-env.js";

import { LocalStorageAdapter } from "../adapters/local-storage.adapter.js";
import { env } from "../config/env.js";
import { db, closeDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { auth } from "../modules/auth/auth.config.js";
import { seedDemo } from "./scenarios/demo.js";
import { seedEdge } from "./scenarios/edge.js";
import { seedEmpty } from "./scenarios/empty.js";
import { seedLarge } from "./scenarios/large.js";
import { req } from "./util.js";
import type { SeedContext, ScenarioSummary } from "./context.js";
import type { SeedImageMode } from "./images/attach.js";

type Scenario = "demo" | "empty" | "large" | "edge";

const SCENARIOS: Record<Scenario, (ctx: SeedContext) => Promise<ScenarioSummary>> = {
  demo: seedDemo,
  empty: seedEmpty,
  large: seedLarge,
  edge: seedEdge,
};

interface CliArgs {
  scenario: Scenario;
  images: SeedImageMode;
  reset: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const flags = new Map<string, string>();
  for (const arg of argv) {
    const match = /^--([^=]+)(?:=(.*))?$/.exec(arg);
    if (!match) continue;
    flags.set(req(match[1], "flag name"), match[2] ?? "true");
  }

  const scenario = (flags.get("scenario") ?? env.SEED_SCENARIO) as Scenario;
  if (!(scenario in SCENARIOS)) {
    throw new Error(
      `Unknown --scenario "${scenario}". Expected one of: ${Object.keys(SCENARIOS).join(", ")}`,
    );
  }

  const images = (flags.get("images") ?? env.SEED_IMAGE_MODE) as SeedImageMode;
  if (!["ingest", "remote", "offline"].includes(images)) {
    throw new Error(`Unknown --images "${images}". Expected one of: ingest, remote, offline`);
  }

  const reset = flags.get("reset") === "true" || process.argv[1]?.includes("db:reset") === true;

  return { scenario, images, reset };
}

async function dropAndMigrate(): Promise<void> {
  await db.execute(`drop schema if exists public cascade`);
  await db.execute(`drop schema if exists drizzle cascade`);
  await db.execute(`create schema public`);
  await runMigrations(db);
}

async function main(): Promise<void> {
  const isResetAlias = process.env["SEED_RESET_ALIAS"] === "true";
  const args = parseArgs(process.argv.slice(2));
  const reset = args.reset || isResetAlias;

  if (reset) {
    console.log("Resetting database (drop schema, migrate)...");
    await dropAndMigrate();
  }

  const storage = new LocalStorageAdapter(env.STORAGE_LOCAL_DIR);
  const ctx: SeedContext = { db, auth, storage, imageMode: args.images };

  console.log(`Seeding scenario "${args.scenario}" (images=${args.images})...`);
  const start = Date.now();
  const summary = await SCENARIOS[args.scenario](ctx);
  const elapsedMs = Date.now() - start;

  console.log(
    `Done in ${elapsedMs}ms — users=${summary.users} pets=${summary.pets} photos=${summary.photos} ` +
      `requests=${summary.requests} favourites=${summary.favourites}`,
  );
}

const isMainModule = process.argv[1] === new URL(import.meta.url).pathname;
if (isMainModule) {
  main()
    .catch((err: unknown) => {
      console.error("Seed failed:", err);
      process.exitCode = 1;
    })
    .finally(() => {
      void closeDb();
    });
}
