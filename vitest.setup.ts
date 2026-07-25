const defaults: Record<string, string> = {
  DATABASE_URL: "postgres://adopta:adopta@localhost:5432/adopta_test",
  AUTH_SECRET: "test-secret-at-least-32-characters-long",
  PUBLIC_ORIGIN: "http://localhost:3000",
  NODE_ENV: "test",
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
