import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import type { MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  /** e.g. "15m" — parsed to milliseconds. */
  window: string;
  max: number;
  by: "ip";
}

export function parseWindowMs(window: string): number {
  const match = /^(\d+)([smh])$/.exec(window);
  if (!match) throw new Error(`Invalid rate-limit window: ${window}`);
  const [, amount, unit] = match as unknown as [string, string, "s" | "m" | "h"];
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000 }[unit];
  return Number(amount) * multiplier;
}

/**
 * An in-memory, single-process fixed-window limiter keyed by client IP —
 * for the routes where the caller has no identity yet (auth). Identified
 * callers are limited by `userRateLimit` instead.
 *
 * Not safe across replicas: each process keeps its own counters, so the
 * effective limit multiplies by the replica count. A shared store is the
 * real fix and is out of scope here.
 */
export function rateLimit(options: RateLimitOptions): MiddlewareHandler {
  const windowMs = parseWindowMs(options.window);
  const hits = new Map<string, { count: number; resetAt: number }>();

  return async (c, next) => {
    const key = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > options.max) {
      throw new DomainThrow(AppErrors.rateLimited(Math.ceil((entry.resetAt - now) / 1000)));
    }

    return next();
  };
}
