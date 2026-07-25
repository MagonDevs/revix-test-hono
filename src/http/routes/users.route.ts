import { Hono } from "hono";
import {
  sessionUserSchema,
  userProfileSchema,
  usersByIdParamsSchema,
  usersUpdateMeInputSchema,
} from "#contracts";
import { usersService } from "../../modules/users/index.js";
import { requireUser } from "../lib/guards.js";
import { parseBody, parseParams } from "../lib/parse.js";
import { json, unwrap } from "../lib/respond.js";
import type { AppVariables } from "../context.js";

export function createUsersRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.patch("/users/me", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const body = await parseBody(c, usersUpdateMeInputSchema);
    const result = await usersService.updateMe(db, caller.id, body);
    return json(c, sessionUserSchema, unwrap(result));
  });

  app.get("/users/:userId", async (c) => {
    const { db } = c.var.ctx;
    const { userId } = parseParams(c, usersByIdParamsSchema);
    const result = await usersService.getUserProfile(db, userId);
    return json(c, userProfileSchema, unwrap(result));
  });

  return app;
}
