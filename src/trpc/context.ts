import { db } from "../db/client.js";
import { createRequestLogger } from "../lib/logger.js";
import { auth } from "../modules/auth/index.js";
import { countAvailablePets, findUserById, mapSessionUser } from "../modules/users/index.js";
import type { SessionUser } from "#contracts";
import type { Database } from "../db/types.js";
import type { Logger } from "../lib/logger.js";
import type { Context as HonoContext } from "hono";

// Architecture §3.1 — the Context interface, exact shape. `now()` and (in
// modules that need one) an id generator are injected rather than called
// globally, so time-dependent behaviour is testable without mocking
// globals. `SessionUser` is the contract's (id/name/city/avatarUrl/
// createdAt/bio/availablePetCount/email/phone) — re-exported here so the
// rest of the server-side code has one place to import it from.

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

interface AppVariables {
  requestId: string;
  logger: Logger;
}

/**
 * B3: resolves the session via `auth.api.getSession`, mapping the
 * Better Auth session+user row onto the contract's `SessionUser`. This
 * requires the `availablePetCount` count query against `pets` (the same
 * one-legitimate-cross-cutting-read used by `users.byId`), so it runs on
 * every authenticated request — acceptable at this stage, worth
 * revisiting for cost if it shows up in profiling later.
 */
async function resolveSession(
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

export async function createContext(c: HonoContext<{ Variables: AppVariables }>): Promise<Context> {
  const requestId = c.var.requestId;
  const logger = c.var.logger ?? createRequestLogger({ requestId });
  const forwardedFor = c.req.header("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? null;

  const { user, sessionId } = await resolveSession(c.req.raw.headers);

  return {
    db,
    user,
    sessionId,
    requestId,
    logger,
    now: () => new Date(),
    ip,
  };
}
