import { createHash } from "node:crypto";
import { faker } from "@faker-js/faker";
import { req } from "./util.js";

export const SEED = 20260725;
export const SEED_EPOCH = new Date("2026-07-01T09:00:00.000Z");

export function resetRng(): void {
  faker.seed(SEED);
}

export function seededId(offsetMs: number): string {
  const timestampMs = SEED_EPOCH.getTime() + offsetMs;
  if (timestampMs < 0 || !Number.isInteger(offsetMs)) {
    throw new Error(`seededId: offsetMs must be a non-negative integer, got ${offsetMs}`);
  }

  const hash = createHash("sha256").update(`${SEED}:${offsetMs}`).digest();

  const tsHex = timestampMs.toString(16).padStart(12, "0").slice(-12);

  const hashByte0 = req(hash.at(0), "hash byte");
  const hashByte1 = req(hash.at(1), "hash byte");
  const hashByte2 = req(hash.at(2), "hash byte");
  const randA = (hashByte0 << 4) | (hashByte1 >> 4);
  const randAHex = ((0x7 << 12) | (randA & 0x0fff)).toString(16).padStart(4, "0");

  const byte2 = ((hashByte2 & 0x3f) | 0x80).toString(16).padStart(2, "0");
  const restHex = Buffer.from(hash.subarray(3, 10)).toString("hex");

  const hex = `${tsHex}${randAHex}${byte2}${restHex}`.padEnd(32, "0").slice(0, 32);

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function seededDate(daysAgo: number, hour = 10): Date {
  const d = new Date(SEED_EPOCH);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

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
