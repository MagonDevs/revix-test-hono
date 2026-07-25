import { db } from "../db/client.js";
import { createRequestLogger } from "../lib/logger.js";
import type { Database } from "../db/types.js";
import type { Logger } from "../lib/logger.js";
import type { Context as HonoContext } from "hono";

// Architecture §3.1 — the Context interface, exact shape. `now()` and (in
// modules that need one) an id generator are injected rather than called
// globally, so time-dependent behaviour is testable without mocking
// globals.

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface Context {
  db: Database;
  user: SessionUser | null;
  sessionId: string | null;
  requestId: string;
  logger: Logger;
  now: () => Date;
  ip: string | null;
}

interface AppVariables {
  requestId: string;
  logger: Logger;
}

/**
 * Builds the tRPC Context from the Hono request context.
 *
 * Session resolution is a TODO: B3 wires `auth.api.getSession` here to
 * populate `user`/`sessionId` from the forwarded cookie. Until then every
 * request is anonymous, which is a correct (if uninteresting) value for
 * this field — `protectedProcedure` already rejects it via
 * `requireSession`.
 */
export function createContext(c: HonoContext<{ Variables: AppVariables }>): Context {
  const requestId = c.var.requestId;
  const logger = c.var.logger ?? createRequestLogger({ requestId });
  const forwardedFor = c.req.header("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

  return {
    db,
    // TODO(B3): resolve via auth.api.getSession({ headers: c.req.raw.headers }).
    user: null,
    sessionId: null,
    requestId,
    logger,
    now: () => new Date(),
    ip,
  };
}
