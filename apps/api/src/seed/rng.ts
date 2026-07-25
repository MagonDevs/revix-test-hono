import { createHash } from "node:crypto";
import { faker } from "@faker-js/faker";
import { req } from "./util.js";

// Spec §6 (04-seeding.md). Determinism requirement §1: "no Date.now(),
// no Math.random(), no crypto.randomUUID() anywhere in the seed." This
// module is the single source of randomness/time for every seed file —
// factories and scenarios must go through it, never through `faker`
// directly without a prior `resetRng()`, and never through `new Date()`
// or the real `IdPort`/`ClockPort` adapters (those are time-of-day
// based, which is the opposite of what a reproducible seed needs).

export const SEED = 20260725;
export const SEED_EPOCH = new Date("2026-07-01T09:00:00.000Z");

/** Re-seeds faker. Call once at the start of every seed run/scenario. */
export function resetRng(): void {
  faker.seed(SEED);
}

/**
 * Deterministic uuid v7. Real uuid v7 mixes wall-clock time and CSPRNG
 * bytes; neither is reproducible. Here the 48-bit timestamp is
 * `SEED_EPOCH + offsetMs` (so ids stay sortable and spread out exactly
 * the way real ids would), and the "random" bits are derived from a
 * SHA-256 of `(SEED, offsetMs)` — a pure function, so the same offset
 * always yields the same id, run after run, machine after machine.
 *
 * Different logical rows should pass different offsets (e.g. an
 * incrementing counter in ms) so ids never collide.
 */
export function seededId(offsetMs: number): string {
  const timestampMs = SEED_EPOCH.getTime() + offsetMs;
  if (timestampMs < 0 || !Number.isInteger(offsetMs)) {
    throw new Error(`seededId: offsetMs must be a non-negative integer, got ${offsetMs}`);
  }

  const hash = createHash("sha256").update(`${SEED}:${offsetMs}`).digest();

  // 48-bit big-endian timestamp.
  const tsHex = timestampMs.toString(16).padStart(12, "0").slice(-12);

  // rand_a: 12 bits from the hash, version nibble forced to 7.
  const hashByte0 = req(hash.at(0), "hash byte");
  const hashByte1 = req(hash.at(1), "hash byte");
  const hashByte2 = req(hash.at(2), "hash byte");
  const randA = (hashByte0 << 4) | (hashByte1 >> 4);
  const randAHex = ((0x7 << 12) | (randA & 0x0fff)).toString(16).padStart(4, "0");

  // rand_b: 62 bits from the hash, variant bits forced to 10.
  const byte2 = ((hashByte2 & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const restHex = Buffer.from(hash.subarray(3, 10)).toString("hex"); // 7 bytes = 14 hex chars

  const hex = `${tsHex}${randAHex}${byte2}${restHex}`.padEnd(32, "0").slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** N days before the epoch, at a stable time of day (UTC hour). */
export function seededDate(daysAgo: number, hour = 10): Date {
  const d = new Date(SEED_EPOCH);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

/**
 * Hands out strictly increasing offsets (in ms) to `seededId`, so every
 * row in a seed run gets a unique, deterministic, sortable id without
 * every call site tracking its own counter.
 */
export class IdSequence {
  private offsetMs: number;

  constructor(startOffsetMs = 0) {
    this.offsetMs = startOffsetMs;
  }

  next(): string {
    const id = seededId(this.offsetMs);
    this.offsetMs += 1;
    return id;
  }
}

export { faker };
