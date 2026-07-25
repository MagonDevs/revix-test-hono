import { metaBreedsOutputSchema } from "@adopta/contracts";
import { describe, expect, it } from "vitest";
import { appRouter } from "./router.js";
import type { Context } from "./context.js";

function makeContext(): Context {
  return {
    db: {} as Context["db"],
    user: null,
    sessionId: null,
    requestId: "req-router-test",
    logger: { info() {}, error() {}, warn() {}, debug() {} } as unknown as Context["logger"],
    now: () => new Date("2026-07-25T00:00:00Z"),
    ip: null,
  };
}

describe("appRouter.meta.breeds", () => {
  it("returns a valid output for a known species", async () => {
    const caller = appRouter.createCaller(makeContext());
    const result = await caller.meta.breeds({ species: "dog" });
    expect(() => metaBreedsOutputSchema.parse(result)).not.toThrow();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("returns a valid output for the 'other' species (B4: now has curated entries)", async () => {
    const caller = appRouter.createCaller(makeContext());
    const result = await caller.meta.breeds({ species: "other" });
    expect(() => metaBreedsOutputSchema.parse(result)).not.toThrow();
    expect(result.items.length).toBeGreaterThan(0);
  });

  it("rejects unknown input keys (strict input schema)", async () => {
    // `createCaller` runs input validation but not `errorFormatter` (that
    // only fires at the HTTP boundary — see trpc/init.test.ts for the
    // `error.data` shape assertions), so this only checks the tRPC code.
    const caller = appRouter.createCaller(makeContext());
    await expect(
      caller.meta.breeds({ species: "dog", extra: "nope" } as never),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("appRouter.auth.session", () => {
  it("returns null when anonymous, without erroring (contract §8.1)", async () => {
    const caller = appRouter.createCaller(makeContext());
    const result = await caller.auth.session();
    expect(result).toBeNull();
  });

  it("returns ctx.user directly when a session is present", async () => {
    const sessionUser: NonNullable<Context["user"]> = {
      id: "user-1",
      name: "Ana",
      email: "ana@example.com",
      city: "Madrid",
      avatarUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      bio: null,
      availablePetCount: 0,
      phone: null,
    };
    const caller = appRouter.createCaller({ ...makeContext(), user: sessionUser });
    const result = await caller.auth.session();
    expect(result).toEqual(sessionUser);
  });
});

describe("appRouter.users.updateMe — protectedProcedure", () => {
  it("rejects an anonymous caller with unauthenticated", async () => {
    const caller = appRouter.createCaller(makeContext());
    await expect(caller.users.updateMe({ city: "Barcelona" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
