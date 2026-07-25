import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { parseWindowMs } from "./rate-limit.middleware.js";
import type { AppVariables } from "../context.js";
import type { MiddlewareHandler } from "hono";

// Architecture §11 — "rate limits on auth, uploads and request creation".
// Auth is IP-keyed (the caller has no identity yet); uploads and request
// creation are keyed by the authenticated user id instead: several
// adopters can share a NAT or office IP, and the id is already known by
// the time these routes run.
//
// Same single-process/in-memory caveat as the IP limiter it sits beside:
// each replica keeps its own counters, so the effective limit multiplies
// by the replica count. A shared store is the real fix and is out of
// scope here.

export interface UserRateLimitOptions {
  /** e.g. "1h" — parsed to milliseconds. */
  window: string;
  max: number;
  /** Scopes the counter, so two limited routes never share a budget. */
  bucket: string;
}

const hits = new Map<string, { count: number; resetAt: number }>();

export function userRateLimit(
  options: UserRateLimitOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  const windowMs = parseWindowMs(options.window);

  return async (c, next) => {
    const user = c.var.ctx.user;
    // Anonymous callers are rejected by the route's own `requireUser`,
    // which produces the correct 401 — a limiter must not turn a missing
    // session into a 429.
    if (!user) return next();

    const key = `${options.bucket}:${user.id}`;
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
