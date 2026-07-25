import { describe, expect, it } from "vitest";
import { IdSequence, SEED_EPOCH, resetRng, seededDate, seededId } from "./rng.js";

// Spec §6: "A test seeds two fresh databases and asserts the row sets
// are identical." The Testcontainers half of that is
// db/test/testcontainers-setup.integration.test.ts-style and gated on a
// live Docker daemon (see docs/notes for the caveat). This file covers
// the pure, no-DB half: the same offset/day always yields the same
// output, which is the property that makes the DB-level assertion true
// in the first place.

describe("seededId", () => {
  it("is a pure function of offsetMs", () => {
    expect(seededId(0)).toBe(seededId(0));
    expect(seededId(12345)).toBe(seededId(12345));
  });

  it("differs across offsets", () => {
    expect(seededId(0)).not.toBe(seededId(1));
  });

  it("produces a valid, sortable uuid v7", () => {
    const id = seededId(0);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("is monotonically sortable by offset", () => {
    const a = seededId(0);
    const b = seededId(1000 * 60 * 60); // 1 hour later
    expect(a < b).toBe(true);
  });

  it("embeds SEED_EPOCH + offsetMs as its timestamp", () => {
    const id = seededId(0);
    const tsHex = id.split("-").slice(0, 3).join("").slice(0, 12);
    const timestampMs = Number.parseInt(tsHex, 16);
    expect(timestampMs).toBe(SEED_EPOCH.getTime());
  });
});

describe("IdSequence", () => {
  it("hands out strictly increasing, unique ids", () => {
    const seq = new IdSequence(0);
    const ids = Array.from({ length: 50 }, () => seq.next());
    expect(new Set(ids).size).toBe(50);
    for (let i = 1; i < ids.length; i++) {
      const current = ids[i];
      const previous = ids[i - 1];
      expect(current !== undefined && previous !== undefined && current > previous).toBe(true);
    }
  });

  it("is reproducible across two fresh sequences", () => {
    const a = new IdSequence(0);
    const b = new IdSequence(0);
    for (let i = 0; i < 10; i++) {
      expect(a.next()).toBe(b.next());
    }
  });
});

describe("seededDate", () => {
  it("is a pure function of (daysAgo, hour)", () => {
    expect(seededDate(10).getTime()).toBe(seededDate(10).getTime());
  });

  it("subtracts whole days from SEED_EPOCH at a stable hour", () => {
    const oneDayEarlier = seededDate(1, 10);
    const twoDaysEarlier = seededDate(2, 10);
    expect(oneDayEarlier.getUTCHours()).toBe(10);
    expect(oneDayEarlier.getTime() - twoDaysEarlier.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it("defaults to hour 10 UTC", () => {
    expect(seededDate(5).getUTCHours()).toBe(10);
  });
});

describe("resetRng", () => {
  it("makes faker output reproducible across resets", async () => {
    const { faker } = await import("./rng.js");
    resetRng();
    const first = faker.string.uuid();
    resetRng();
    const second = faker.string.uuid();
    expect(first).toBe(second);
  });
});
