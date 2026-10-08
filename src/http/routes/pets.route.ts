import { Hono } from "hono";
import {
  createPetRequestSchema,
  LIMITS,
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
import type { Pet, PetSize } from "#contracts";
import type { AppVariables } from "../context.js";

const SIZE_RANK: Record<PetSize, number> = { small: 0, medium: 1, large: 2 };

function similarityScore(source: Pet, candidate: Pet): number {
  let score = 0;
  const sizeGap = Math.abs(SIZE_RANK[candidate.size] - SIZE_RANK[source.size]);
  if (sizeGap === 0) score += 2;
  else if (sizeGap === 1) score += 1;
  if (Math.abs(candidate.ageMonths - source.ageMonths) <= 12) score += 2;
  if (candidate.breed !== null && candidate.breed === source.breed) score += 1;
  return score;
}

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

  app.get("/pets/:petId/similar", async (c) => {
    const { db, user } = c.var.ctx;
    const { petId } = parseParams(c, petIdParamsSchema);
    const page = Number.parseInt(c.req.query("page") ?? "", 10) || 1;
    const perPage = Math.min(
      Number.parseInt(c.req.query("perPage") ?? "", 10) || LIMITS.list.perPageDefault,
      LIMITS.list.perPageMax,
    );
    const result = await petsService.listSimilar(db, { petId, page, perPage }, user?.id ?? null);
    const { source, items, meta } = unwrap(result);
    const ranked = items
      .filter((pet) => pet.id !== source.id)
      .map((pet) => ({ pet, score: similarityScore(source, pet) }))
      .sort((a, b) => b.score - a.score)
      .map(({ pet }) => pet);
    return json(c, petsListOutputSchema, { items: ranked, meta });
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
