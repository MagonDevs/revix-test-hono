import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import type { AppVariables, SessionUser } from "../context.js";
import type { Context } from "hono";

/**
 * The authentication boundary for a protected route: returns the caller,
 * or raises `unauthenticated` (401) when there is no session.
 *
 * A guard function rather than a mounted middleware, deliberately — it
 * hands the handler a non-nullable `SessionUser`, so a protected handler
 * cannot compile while still treating the caller as possibly anonymous.
 * A middleware would enforce the same 401 at runtime but leave
 * `ctx.user` typed as nullable at every use site.
 */
export function requireUser(c: Context<{ Variables: AppVariables }>): SessionUser {
  const user = c.var.ctx.user;
  if (!user) throw new DomainThrow(AppErrors.unauthenticated());
  return user;
}
