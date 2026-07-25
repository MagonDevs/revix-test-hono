import { createRequestLogger } from "../lib/logger.js";
import { auth } from "../modules/auth/index.js";
import { countAvailablePets, findUserById, mapSessionUser } from "../modules/users/index.js";
import type { SessionUser } from "#contracts";
import type { Database } from "../db/types.js";
import type { Logger } from "../lib/logger.js";
import type { Context as HonoContext, MiddlewareHandler } from "hono";

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
  scrubbedBody?: unknown;
}

async function resolveSession(
  db: Database,
  headers: Headers,
): Promise<{ user: SessionUser; sessionId: string } | { user: null; sessionId: null }> {
  const session = await auth.api.getSession({ headers }).catch(() => null);
  if (!session?.user) return { user: null, sessionId: null };

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

export function contextMiddleware(db: Database): MiddlewareHandler<{ Variables: AppVariables }> {
  return async (c, next) => {
    c.set("ctx", await createContext(db, c));
    await next();
  };
}
