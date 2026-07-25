import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { err } from "neverthrow";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppErrors, type AppError } from "../errors/app-error.js";
import { protectedProcedure, publicProcedure, router } from "./init.js";
import { unwrap } from "./unwrap.js";
import type { Context } from "./context.js";

// Architecture §3.1 / contract §5 — errorFormatter attaches
// appCode/conflictReason/fieldErrors/retryAfterSeconds/requestId to
// error.data. `createCaller` (used by the router-level tests elsewhere)
// does NOT run errorFormatter — only the HTTP boundary does — so these
// assertions go through `app.request()` against a small test router
// mounted the same way `http/app.ts` mounts the real one.

const testRouter = router({
  fail: publicProcedure.input(z.object({ appCode: z.string() })).query(({ input }) => {
    const builders: Record<string, () => AppError> = {
      validation_error: () => AppErrors.invalidField("name", "too short"),
      unauthenticated: () => AppErrors.unauthenticated(),
      forbidden: () => AppErrors.forbidden(),
      not_found: () => AppErrors.notFound("Pet"),
      conflict: () => AppErrors.conflict("duplicate_email", "already used"),
      rate_limited: () => AppErrors.rateLimited(42),
      internal_error: () => AppErrors.internal("boom"),
    };
    const build = builders[input.appCode];
    if (!build) throw new Error(`unknown appCode ${input.appCode}`);
    return unwrap(err<never, AppError>(build()));
  }),
  strictInput: publicProcedure
    .input(z.object({ name: z.string().min(3), age: z.number().int() }).strict())
    .query(() => ({ ok: true })),
  throws: publicProcedure.query(() => {
    throw new Error("unexpected boom with a secret stack trace");
  }),
  requiresSession: protectedProcedure.query(({ ctx }) => ({ userId: ctx.user.id })),
});

function buildTestApp(user: Context["user"] = null) {
  const app = new Hono<{ Variables: { requestId: string } }>();
  app.use("*", async (c, next) => {
    c.set("requestId", "req-test-1");
    await next();
  });
  app.use(
    "/trpc/*",
    trpcServer({
      endpoint: "/trpc",
      router: testRouter,
      createContext: (): Record<string, unknown> => {
        const context: Context = {
          db: {} as Context["db"],
          user,
          sessionId: null,
          requestId: "req-test-1",
          logger: { info() {}, error() {}, warn() {}, debug() {} } as unknown as Context["logger"],
          now: () => new Date("2026-07-25T00:00:00Z"),
          ip: null,
        };
        return context as unknown as Record<string, unknown>;
      },
    }),
  );
  return app;
}

// The transformer is superjson, so GET query input must carry the
// `{ json: ... }` envelope, and the error/result shape nests the actual
// data under `.json` too.
function superjsonInput(value: unknown): string {
  return encodeURIComponent(JSON.stringify({ json: value }));
}

async function callFailing(appCode: string) {
  const app = buildTestApp();
  const res = await app.request(`/trpc/fail?input=${superjsonInput({ appCode })}`);
  const body = (await res.json()) as { error: { json: { data: Record<string, unknown> } } };
  return { status: res.status, data: body.error.json.data };
}

describe("errorFormatter — AppError -> error.data shape (contract §5.3)", () => {
  it("validation_error carries fieldErrors", async () => {
    const { data } = await callFailing("validation_error");
    expect(data).toMatchObject({
      appCode: "validation_error",
      fieldErrors: [{ field: "name", message: "too short" }],
      requestId: "req-test-1",
    });
  });

  it("unauthenticated carries just appCode + requestId", async () => {
    const { data } = await callFailing("unauthenticated");
    expect(data).toMatchObject({ appCode: "unauthenticated", requestId: "req-test-1" });
  });

  it("forbidden carries just appCode + requestId", async () => {
    const { data } = await callFailing("forbidden");
    expect(data).toMatchObject({ appCode: "forbidden", requestId: "req-test-1" });
  });

  it("not_found carries just appCode + requestId", async () => {
    const { data } = await callFailing("not_found");
    expect(data).toMatchObject({ appCode: "not_found", requestId: "req-test-1" });
  });

  it("conflict carries conflictReason", async () => {
    const { data } = await callFailing("conflict");
    expect(data).toMatchObject({
      appCode: "conflict",
      conflictReason: "duplicate_email",
      requestId: "req-test-1",
    });
  });

  it("rate_limited carries retryAfterSeconds", async () => {
    const { data } = await callFailing("rate_limited");
    expect(data).toMatchObject({
      appCode: "rate_limited",
      retryAfterSeconds: 42,
      requestId: "req-test-1",
    });
  });

  it("internal_error carries only appCode + requestId — no cause, no message detail on the wire", async () => {
    const { data } = await callFailing("internal_error");
    expect(data).toMatchObject({ appCode: "internal_error", requestId: "req-test-1" });
    expect(data).not.toHaveProperty("cause");
    expect(JSON.stringify(data)).not.toMatch(/boom/);
  });

  it("a Zod input failure produces fieldErrors matching the input schema's paths", async () => {
    const app = buildTestApp();
    const res = await app.request(
      `/trpc/strictInput?input=${superjsonInput({ name: "ab", age: 1.5 })}`,
    );
    const body = (await res.json()) as {
      error: { json: { data: { appCode: string; fieldErrors: Array<{ field: string }> } } };
    };
    expect(body.error.json.data.appCode).toBe("validation_error");
    expect(body.error.json.data.fieldErrors.map((f) => f.field)).toEqual(
      expect.arrayContaining(["name", "age"]),
    );
  });

  it("a deliberate throw inside a procedure becomes internal_error carrying only the request id", async () => {
    const app = buildTestApp();
    const res = await app.request("/trpc/throws");
    const body = (await res.json()) as { error: { json: { data: Record<string, unknown> } } };
    expect(body.error.json.data).toMatchObject({
      appCode: "internal_error",
      requestId: "req-test-1",
    });
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/secret stack trace/);
    expect(serialized).not.toMatch(/\bat .*:\d+:\d+/); // no stack frames
  });
});

describe("protectedProcedure / requireSession", () => {
  it("throws unauthenticated when ctx.user is null", async () => {
    const app = buildTestApp(null);
    const res = await app.request("/trpc/requiresSession");
    const body = (await res.json()) as { error: { json: { data: { appCode: string } } } };
    expect(body.error.json.data.appCode).toBe("unauthenticated");
  });

  it("passes through and narrows ctx.user when present", async () => {
    const app = buildTestApp({ id: "user-1", name: "Ana", email: "ana@example.com" });
    const res = await app.request("/trpc/requiresSession");
    const body = (await res.json()) as { result: { data: { json: { userId: string } } } };
    expect(body.result.data.json.userId).toBe("user-1");
  });
});
