import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import type { AppVariables, SessionUser } from "../context.js";
import type { Context } from "hono";

export function requireUser(c: Context<{ Variables: AppVariables }>): SessionUser {
  const user = c.var.ctx.user;
  if (!user) throw new DomainThrow(AppErrors.unauthenticated());
  return user;
}
