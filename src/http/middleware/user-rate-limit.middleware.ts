import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { parseWindowMs } from "./rate-limit.middleware.js";
import type { AppVariables } from "../context.js";
import type { MiddlewareHandler } from "hono";

export interface UserRateLimitOptions {
  window: string;
  max: number;
  bucket: string;
}

const hits = new Map<string, { count: number; resetAt: number }>();

export function userRateLimit(
  options: UserRateLimitOptions,
): MiddlewareHandler<{ Variables: AppVariables }> {
  const windowMs = parseWindowMs(options.window);

  return async (c, next) => {
    const user = c.var.ctx.user;
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
