import { createRequestLogger } from "../lib/logger.js";
import { auth } from "../modules/auth/index.js";
import { countAvailablePets, findUserById, mapSessionUser } from "../modules/users/index.js";
import type { SessionUser } from "#contracts";
import type { Database } from "../db/types.js";
import type { Logger } from "../lib/logger.js";
import type { Context as HonoContext, MiddlewareHandler } from "hono";

// Architecture §3.1 — the request Context, exact shape. `now()` is
// injected rather than called globally so time-dependent behaviour is
// testable without mocking globals. `SessionUser` is the contract's —
// re-exported here so the rest of the server-side code has one place to
// import it from.

export type { SessionUser } from "#contracts";

export interface Context {
  db: Database;
  user: SessionUser | null;
  sessionId: string | null;
  requestId: string;
  logger: Logger;
  now: () => Date;
  ip: string | null;
}

export interface AppVariables {
  requestId: string;
  logger: Logger;
  ctx: Context;
  /**
   * The parsed request body, already scrubbed of credential-shaped fields
   * (http/lib/scrub.ts). Set by `parseBody` purely so `httpErrorHandler`
   * can attach it to an unexpected-error log line — the body stream is
   * long consumed by the time the handler runs.
   */
  scrubbedBody?: unknown;
}

/**
 * B3: resolves the session via `auth.api.getSession`, mapping the
 * Better Auth session+user row onto the contract's `SessionUser`. This
 * requires the `availablePetCount` count query against `pets` (the same
 * one-legitimate-cross-cutting-read used by `GET /users/:userId`), so it
 * runs on every authenticated request — acceptable at this stage, worth
 * revisiting for cost if it shows up in profiling later.
 */
async function resolveSession(
  db: Database,
  headers: Headers,
): Promise<{ user: SessionUser; sessionId: string } | { user: null; sessionId: null }> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return { user: null, sessionId: null };

  // Better Auth's session.user already carries the additionalFields
  // (city/phone/bio) declared in auth.config.ts, matching UserRow.
  const row = (await findUserById(db, session.user.id)) ?? {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? null,
    city: (session.user as { city?: string }).city ?? "",
    phone: (session.user as { phone?: string | null }).phone ?? null,
    bio: (session.user as { bio?: string | null }).bio ?? null,
    createdAt: session.user.createdAt,
  };

  const availablePetCount = await countAvailablePets(db, row.id);
  return {
    user: mapSessionUser(row, availablePetCount),
    sessionId: session.session.id,
  };
}

export async function createContext(
  db: Database,
  c: HonoContext<{ Variables: AppVariables }>,
): Promise<Context> {
  const requestId = c.var.requestId;
  const logger = c.var.logger ?? createRequestLogger({ requestId });
  const forwardedFor = c.req.header("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

  const { user, sessionId } = await resolveSession(db, c.req.raw.headers);

  return { db, user, sessionId, requestId, logger, now: () => new Date(), ip };
}

/**
 * Builds the Context once per request and puts it on `c.var.ctx`, so the
 * session is resolved a single time no matter how many handlers or guards
 * read it. Mounted on the API surface only — `/health`, `/ready` and the
 * raw-bytes upload route are anonymous by design and must not pay for a
 * session lookup.
 */
export function contextMiddleware(db: Database): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    c.set("ctx", await createContext(db, c));
    await next();
  };
}
