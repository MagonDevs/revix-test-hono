import type { MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  /** e.g. "15m" — parsed to milliseconds. */
  window: string;
  max: number;
  by: "ip";
}

function parseWindowMs(window: string): number {
  const match = /^(\d+)([smh])$/.exec(window);
  if (!match) throw new Error(`Invalid rate-limit window: ${window}`);
  const [, amount, unit] = match as unknown as [string, string, "s" | "m" | "h"];
  const multiplier = { s: 1000, m: 60_000, h: 3_600_000 }[unit];
  return Number(amount) * multiplier;
}

/**
 * B2 stub: an in-memory, single-process fixed-window limiter. Enough to
 * wire the middleware slot into `app.ts` at the right point (before the
 * handler it protects) so B9's real implementation (likely backed by a
 * shared store, for multi-instance correctness) drops in without moving
 * call sites. Not safe across multiple replicas.
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
      await next();
      return;
    }

    entry.count += 1;
    if (entry.count > options.max) {
      const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json(
        {
          error: {
            message: "Too many requests",
            data: {
              appCode: "rate_limited",
              retryAfterSeconds,
              requestId: c.get("requestId") as string,
            },
          },
        },
        429,
      );
    }

    await next();
  };
}
