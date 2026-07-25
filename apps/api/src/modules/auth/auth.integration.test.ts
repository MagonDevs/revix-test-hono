import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../../db/migrate.js";

// Architecture §5 / contract §7.1-7.3 — B3 integration coverage:
//   - sign-up creates a Better Auth user + account row
//   - sign-in sets a session cookie
// Requires a real Docker daemon (Testcontainers Postgres). Same pattern
// as db/test/testcontainers-setup.integration.test.ts (B1): excluded
// from `pnpm test` by filename, run only via `pnpm test:integration`.
//
// NOTE: `auth.config.ts` and `db/client.ts` build their `db`/`auth`
// singletons from `process.env`/the parsed `env` at import time, so this
// test sets `DATABASE_URL` etc. to the container's connection string and
// then dynamically imports those modules — they must not be imported
// (directly or transitively) anywhere above this point in the file.
//
// STATUS: not run in this sandbox — `docker ps` fails here
// ("failed to connect to the docker API ... no such file or directory"),
// same finding as B1. Written to be correct and to run unmodified in an
// environment with Docker available.

let container: StartedPostgreSqlContainer;

describe("Better Auth — sign-up / sign-in (requires Docker)", () => {
  beforeAll(async () => {
    container = await new PostgreSqlContainer("postgres:16")
      .withDatabase("adopta_auth_test")
      .withUsername("adopta")
      .withPassword("adopta")
      .start();

    process.env["DATABASE_URL"] = container.getConnectionUri();
    process.env["AUTH_SECRET"] = "test-secret-at-least-32-characters-long";
    process.env["PUBLIC_ORIGIN"] = "http://localhost:3000";
    process.env["NODE_ENV"] = "test";

    const { db } = await import("../../db/client.js");
    await runMigrations(db);
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  });

  it("sign-up creates a user + account row", async () => {
    const { auth } = await import("./auth.config.js");
    const { db } = await import("../../db/client.js");
    const { user, account } = await import("../../db/schema/auth.js");
    const { eq } = await import("drizzle-orm");

    const res = await auth.api.signUpEmail({
      body: {
        name: "Ana Garcia",
        email: "ana@example.com",
        password: "correct horse battery",
        city: "Madrid",
      },
      asResponse: true,
    });
    expect(res.status).toBeLessThan(300);

    const userRows = await db.select().from(user).where(eq(user.email, "ana@example.com"));
    expect(userRows).toHaveLength(1);
    const createdUser = userRows[0];
    expect(createdUser).toBeDefined();

    const accountRows = await db
      .select()
      .from(account)
      .where(eq(account.userId, createdUser?.id ?? ""));
    expect(accountRows.length).toBeGreaterThan(0);
  });

  it("sign-up with a duplicate email returns the normalised conflict shape via the HTTP wrapper", async () => {
    const { createAuthRoutes } = await import("../../http/routes/auth.route.js");
    const app = createAuthRoutes();

    const signUpBody = {
      name: "Ana Duplicate",
      email: "duplicate@example.com",
      password: "correct horse battery",
      city: "Madrid",
    };

    const first = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signUpBody),
    });
    expect(first.status).toBeLessThan(300);

    const second = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signUpBody),
    });
    const body = (await second.json()) as { error: { data: { appCode: string } } };
    expect(second.status).toBe(409);
    expect(body.error.data.appCode).toBe("conflict");
  });

  it("sign-in sets a session cookie", async () => {
    const { createAuthRoutes } = await import("../../http/routes/auth.route.js");
    const app = createAuthRoutes();

    await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Carlos Ruiz",
        email: "carlos@example.com",
        password: "correct horse battery",
        city: "Sevilla",
      }),
    });

    const res = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "carlos@example.com", password: "correct horse battery" }),
    });

    expect(res.status).toBeLessThan(300);
    expect(res.headers.get("set-cookie")).toMatch(/adopta\.session_token/);
  });
});
