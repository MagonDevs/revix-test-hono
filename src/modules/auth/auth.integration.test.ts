import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runMigrations } from "../../db/migrate.js";
import type { ApiErrorBody, SessionUser } from "#contracts";

// Architecture §5 / contract §7.1-7.3 — B3 integration coverage of the
// REST auth facade (`/api/v1/auth/*`), which wraps Better Auth:
//   - register creates a Better Auth user + account row
//   - a duplicate email surfaces as the contract's conflict, not Better
//     Auth's own 422 shape
//   - login sets a session cookie that a later request is authenticated by
//
// Requires a real Docker daemon (Testcontainers Postgres). Same pattern
// as db/test/testcontainers-setup.integration.test.ts (B1): excluded
// from `pnpm test` by filename, run only via `pnpm test:integration`.
//
// NOTE: `auth.config.ts`, `db/client.ts` and `http/app.ts` build their
// singletons from the parsed `env` at import time, so this test sets
// `DATABASE_URL` etc. to the container's connection string and then
// dynamically imports those modules — they must not be imported
// (directly or transitively) anywhere above this point in the file.

let container: StartedPostgreSqlContainer;

const AUTH = "/api/v1/auth";

async function loadApp() {
  const { app } = await import("../../http/app.js");
  return app;
}

describe("REST auth facade — register / login / session (requires Docker)", () => {
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
    // Drain the pool before killing the container. Otherwise Postgres
    // terminates the still-open connections on shutdown and `pg` raises
    // that as an unhandled error outside any test, failing the run even
    // though every assertion passed.
    const { closeDb } = await import("../../db/client.js");
    await closeDb();
    await container?.stop();
  });

  it("register creates a user + account row and answers with the SessionUser", async () => {
    const app = await loadApp();
    const { db } = await import("../../db/client.js");
    const { user, account } = await import("../../db/schema/auth.js");
    const { eq } = await import("drizzle-orm");

    const res = await app.request(`${AUTH}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Ana Garcia",
        email: "ana@example.com",
        password: "correct horse battery",
        city: "Madrid",
      }),
    });

    expect(res.status).toBe(201);

    // The response is the contract's SessionUser, not Better Auth's own
    // user object — `availablePetCount` is the tell, and email/phone are
    // present here (and only here, per R-22).
    const body = (await res.json()) as SessionUser;
    expect(body).toMatchObject({
      name: "Ana Garcia",
      email: "ana@example.com",
      city: "Madrid",
      availablePetCount: 0,
    });

    const userRows = await db.select().from(user).where(eq(user.email, "ana@example.com"));
    expect(userRows).toHaveLength(1);
    const createdUser = userRows[0];
    expect(createdUser).toBeDefined();
    // The contract types every id as a UUID, including auth-owned rows —
    // see `advanced.database.generateId` in auth.config.ts.
    expect(createdUser?.id).toMatch(/^[0-9a-f-]{36}$/i);

    const accountRows = await db
      .select()
      .from(account)
      .where(eq(account.userId, createdUser?.id ?? ""));
    expect(accountRows.length).toBeGreaterThan(0);
  });

  it("register with a duplicate email returns the contract's conflict, not Better Auth's shape", async () => {
    const app = await loadApp();
    const signUpBody = {
      name: "Ana Duplicate",
      email: "duplicate@example.com",
      password: "correct horse battery",
      city: "Madrid",
    };

    const first = await app.request(`${AUTH}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signUpBody),
    });
    expect(first.status).toBe(201);

    const second = await app.request(`${AUTH}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(signUpBody),
    });
    expect(second.status).toBe(409);

    const body = (await second.json()) as ApiErrorBody;
    expect(body.error.code).toBe("conflict");
    expect(body.error.conflictReason).toBe("duplicate_email");
  });

  it("login sets a session cookie that authenticates a later request", async () => {
    const app = await loadApp();

    await app.request(`${AUTH}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Carlos Ruiz",
        email: "carlos@example.com",
        password: "correct horse battery",
        city: "Sevilla",
      }),
    });

    const res = await app.request(`${AUTH}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "carlos@example.com", password: "correct horse battery" }),
    });

    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toMatch(/adopta\.session_token/);

    // The whole point of the cookie: the next request is authenticated by
    // it, with no bearer token or manual plumbing on the client's side.
    const session = await app.request(`${AUTH}/session`, {
      headers: { cookie: setCookie ?? "" },
    });
    expect(session.status).toBe(200);
    expect((await session.json()) as SessionUser).toMatchObject({ email: "carlos@example.com" });
  });

  it("R-21: a wrong password is indistinguishable from an unknown email", async () => {
    const app = await loadApp();

    const wrongPassword = await app.request(`${AUTH}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "carlos@example.com", password: "not the password" }),
    });
    const unknownEmail = await app.request(`${AUTH}/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "not the password" }),
    });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);

    const a = (await wrongPassword.json()) as ApiErrorBody;
    const b = (await unknownEmail.json()) as ApiErrorBody;
    expect(a.error.code).toBe("unauthenticated");
    expect(a.error.message).toBe(b.error.message);
  });

  it("GET /auth/session is 401 when anonymous — never 200 with a null body", async () => {
    const app = await loadApp();
    const res = await app.request(`${AUTH}/session`);

    expect(res.status).toBe(401);
    expect((await res.json()) as ApiErrorBody).toMatchObject({
      error: { code: "unauthenticated" },
    });
  });
});
