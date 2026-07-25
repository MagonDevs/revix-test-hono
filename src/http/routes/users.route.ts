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

// Contract §8.2 as REST.
//
// `/users/me` is registered before `/users/:userId` on purpose: Hono
// matches in registration order, so the literal path has to come first or
// `me` would be swallowed as a user id and answer 400 on the uuid check.

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
