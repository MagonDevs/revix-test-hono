import { z } from "zod";

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

export const env: Env = parseEnv();
