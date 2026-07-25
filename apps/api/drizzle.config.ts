import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_URL"] ?? "postgres://adopta:adopta@localhost:5432/adopta",
  },
  verbose: true,
  strict: true,
});
