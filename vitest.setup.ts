// Unit tests (no real DB) still import modules that parse `env` at import
// time (config/env.ts -> http/app.ts, index.ts, etc). Provide harmless
// defaults for the required fields so `pnpm test` doesn't depend on a
// developer's shell having them exported. Never overrides a value the
// environment already provides.
const defaults: Record<string, string> = {
  DATABASE_URL: "postgres://adopta:adopta@localhost:5432/adopta_test",
  AUTH_SECRET: "test-secret-at-least-32-characters-long",
  PUBLIC_ORIGIN: "http://localhost:3000",
  NODE_ENV: "test",
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
