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

  it("returns an empty list for a species with no curated breeds", async () => {
    const caller = appRouter.createCaller(makeContext());
    const result = await caller.meta.breeds({ species: "other" });
    expect(result).toEqual({ items: [] });
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
