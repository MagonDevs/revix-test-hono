import { Hono } from "hono";
import {
  createPetRequestSchema,
  petIdParamsSchema,
  petSchema,
  petsListByOwnerOutputSchema,
  petsListByOwnerQuerySchema,
  petsListMineOutputSchema,
  petsListMineQuerySchema,
  petsListOutputSchema,
  petsListQuerySchema,
  updatePetRequestSchema,
  updatePetStatusRequestSchema,
  usersByIdParamsSchema,
} from "#contracts";
import { petsService } from "../../modules/pets/index.js";
import { requireUser } from "../lib/guards.js";
import { parseBody, parseParams, parseQuery } from "../lib/parse.js";
import { json, noContent, unwrap } from "../lib/respond.js";
import type { AppVariables } from "../context.js";

// Contract §8.3 as REST. A handler does exactly three things: parse the
// request through a contract schema, call the service, serialise the
// result through the output schema (architecture §2.1 — no logic here).
//
// The pet id always comes from the path and is merged into the service's
// input; it is never accepted in a body, so a caller cannot address one
// pet in the URL and a different one in the payload.

export function createPetsRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/pets", async (c) => {
    const { db, user } = c.var.ctx;
    const query = parseQuery(c, petsListQuerySchema);
    const result = await petsService.list(db, query, user?.id ?? null);
    return json(c, petsListOutputSchema, unwrap(result));
  });

  app.post("/pets", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const body = await parseBody(c, createPetRequestSchema);
    const result = await petsService.create(db, caller.id, body);
    return json(c, petSchema, unwrap(result), 201);
  });

  app.get("/pets/:petId", async (c) => {
    const { db, user } = c.var.ctx;
    const { petId } = parseParams(c, petIdParamsSchema);
    const result = await petsService.byId(db, petId, user?.id ?? null);
    return json(c, petSchema, unwrap(result));
  });

  app.patch("/pets/:petId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    const body = await parseBody(c, updatePetRequestSchema);
    const result = await petsService.update(db, caller.id, { petId, ...body });
    return json(c, petSchema, unwrap(result));
  });

  app.patch("/pets/:petId/status", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    const body = await parseBody(c, updatePetStatusRequestSchema);
    const result = await petsService.setStatus(db, caller.id, { petId, ...body });
    return json(c, petSchema, unwrap(result));
  });

  // 204: the deleted id is the one the caller just named in the path, so
  // echoing it back would tell them nothing they don't have.
  app.delete("/pets/:petId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    unwrap(await petsService.remove(db, caller.id, petId));
    return noContent(c);
  });

  app.get("/me/pets", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const query = parseQuery(c, petsListMineQuerySchema);
    const result = await petsService.listMine(db, caller.id, query);
    return json(c, petsListMineOutputSchema, unwrap(result));
  });

  // A user's public pets. Lives here rather than in users.route.ts — it
  // returns `Pet`, and the visibility rules are the pets module's.
  app.get("/users/:userId/pets", async (c) => {
    const { db, user } = c.var.ctx;
    const { userId } = parseParams(c, usersByIdParamsSchema);
    const query = parseQuery(c, petsListByOwnerQuerySchema);
    const result = await petsService.listByOwner(
      db,
      { ownerId: userId, ...query },
      user?.id ?? null,
    );
    return json(c, petsListByOwnerOutputSchema, unwrap(result));
  });

  return app;
}
