import { z } from "zod";

// Architecture §8 — parsed once at boot. The process exits with a readable
// message rather than failing on the first request. The schema and the
// parse function are kept separate and exported so they stay testable in
// isolation, without triggering `process.exit` as a side effect of import.

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(8787),
  DATABASE_URL: z.string().startsWith("postgres"),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  AUTH_SECRET: z.string().min(32),
  PUBLIC_ORIGIN: z.url(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./.storage"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SEED_SCENARIO: z.enum(["demo", "empty", "large", "edge"]).default("demo"),
  SEED_IMAGE_MODE: z.enum(["ingest", "remote", "offline"]).default("ingest"),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parses and validates `process.env`-shaped input against {@link envSchema}.
 * Kept separate from module-level parsing so tests can exercise both valid
 * and invalid input without mutating `process.env` or triggering an exit.
 */
export function parseEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}

/**
 * Parsed once at import time for real entry points (index.ts, and anything
 * that needs the live config). Tests that want to exercise failure modes
 * should call {@link parseEnv} directly instead of importing this.
 */
export const env: Env = parseEnv();
