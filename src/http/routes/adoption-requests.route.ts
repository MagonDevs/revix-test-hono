import { Hono } from "hono";
import {
  adoptionRequestSchema,
  adoptionRequestsListOutputSchema,
  adoptionRequestsListQuerySchema,
  createAdoptionRequestRequestSchema,
  petIdParamsSchema,
  requestIdParamsSchema,
  respondToRequestRequestSchema,
} from "#contracts";
import { adoptionRequestsService } from "../../modules/adoption-requests/index.js";
import { requireUser } from "../lib/guards.js";
import { parseBody, parseParams, parseQuery } from "../lib/parse.js";
import { json, noContent, unwrap } from "../lib/respond.js";
import { userRateLimit } from "../middleware/user-rate-limit.middleware.js";
import type { AppVariables } from "../context.js";

const CREATE_LIMIT = { window: "1h", max: 20, bucket: "adoption-request-create" } as const;

export function createAdoptionRequestsRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/pets/:petId/adoption-requests", userRateLimit(CREATE_LIMIT), async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    const body = await parseBody(c, createAdoptionRequestRequestSchema);
    const result = await adoptionRequestsService.create(db, caller.id, { petId, ...body });
    return json(c, adoptionRequestSchema, unwrap(result), 201);
  });

  app.get("/me/adoption-requests", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const query = parseQuery(c, adoptionRequestsListQuerySchema);
    const result = await adoptionRequestsService.list(db, caller.id, query);
    return json(c, adoptionRequestsListOutputSchema, unwrap(result));
  });

  app.get("/adoption-requests/:requestId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { requestId } = parseParams(c, requestIdParamsSchema);
    const result = await adoptionRequestsService.byId(db, caller.id, requestId);
    return json(c, adoptionRequestSchema, unwrap(result));
  });

  app.patch("/adoption-requests/:requestId/status", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { requestId } = parseParams(c, requestIdParamsSchema);
    const body = await parseBody(c, respondToRequestRequestSchema);
    const result = await adoptionRequestsService.respond(db, caller.id, { requestId, ...body });
    return json(c, adoptionRequestSchema, unwrap(result));
  });

  app.delete("/adoption-requests/:requestId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { requestId } = parseParams(c, requestIdParamsSchema);
    unwrap(await adoptionRequestsService.withdraw(db, caller.id, requestId));
    return noContent(c);
  });

  return app;
}
