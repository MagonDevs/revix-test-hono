import { describe, expect, it } from "vitest";
import { API_PREFIX, app } from "./app.js";
import type { ApiErrorBody } from "#contracts";

describe("GET /health", () => {
  it("returns 200 (liveness)", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
  });
});

describe("GET /ready", () => {
  it("responds (200 with a DB, 503 without) — never throws, always distinct from /health's contract", async () => {
    const res = await app.request("/ready");
    expect([200, 503]).toContain(res.status);
  });
});

describe(`${API_PREFIX}/* responses`, () => {
  it("carry Cache-Control: private, no-store", async () => {
    const res = await app.request(`${API_PREFIX}/meta/breeds?species=dog`);
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("error envelope", () => {
  it("reports a missing query param as a validation_error with the offending field", async () => {
    const res = await app.request(`${API_PREFIX}/meta/breeds`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("validation_error");
    expect(body.error.requestId).toBeTruthy();
    expect(body.error.details?.map((d) => d.field)).toContain("species");
  });

  it("rejects a malformed path id with 400, not 404 — the shape is wrong, not the row missing", async () => {
    const res = await app.request(`${API_PREFIX}/pets/not-a-uuid`);
    expect(res.status).toBe(400);

    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("validation_error");
  });

  it("echoes a caller-supplied x-request-id so a client can correlate its own logs", async () => {
    const res = await app.request(`${API_PREFIX}/meta/breeds`, {
      headers: { "x-request-id": "req-from-client" },
    });
    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.requestId).toBe("req-from-client");
    expect(res.headers.get("x-request-id")).toBe("req-from-client");
  });
});

describe("uploads (B6)", () => {
  it("GET /uploads/:uploadId/raw returns 404 for a malformed id, never a 500", async () => {
    const res = await app.request(`${API_PREFIX}/uploads/not-a-uuid/raw`);
    expect(res.status).toBe(404);
  });

  it("POST /uploads without a session is 401 in the standard envelope", async () => {
    const res = await app.request(`${API_PREFIX}/uploads`, {
      method: "POST",
      body: new FormData(),
    });
    expect(res.status).toBe(401);

    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("unauthenticated");
    expect(body.error.requestId).toBeTruthy();
  });
});

describe("the authenticated surface", () => {
  it.each([
    ["GET", "/me/pets"],
    ["GET", "/me/favourites"],
    ["GET", "/me/adoption-requests?role=adopter"],
    ["GET", "/auth/session"],
    ["POST", "/pets"],
  ])("%s %s answers 401 when anonymous", async (method, path) => {
    const res = await app.request(`${API_PREFIX}${path}`, { method });
    expect(res.status).toBe(401);

    const body = (await res.json()) as ApiErrorBody;
    expect(body.error.code).toBe("unauthenticated");
  });
});
