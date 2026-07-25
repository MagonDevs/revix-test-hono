import { describe, expect, it } from "vitest";
import { app } from "./app.js";

// Contract §2, §7.6 — health endpoints and the no-store header, exercised
// via `app.request()` (no real socket, no real DB required for these
// specific assertions).

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

describe("/trpc/* responses", () => {
  it("carry Cache-Control: private, no-store", async () => {
    const input = encodeURIComponent(JSON.stringify({ json: { species: "dog" } }));
    const res = await app.request(`/trpc/meta.breeds?input=${input}`);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});

describe("/api/uploads (B6)", () => {
  it("GET /api/uploads/:uploadId/raw returns 404 for a malformed id, never a 500", async () => {
    const res = await app.request("/api/uploads/not-a-uuid/raw");
    expect(res.status).toBe(404);
  });

  it("POST /api/uploads without a session returns the standard unauthenticated shape", async () => {
    const res = await app.request("/api/uploads", { method: "POST", body: new FormData() });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: { data: { appCode: string; requestId: string } } };
    expect(body.error.data.appCode).toBe("unauthenticated");
    expect(body.error.data.requestId).toBeTruthy();
  });
});
