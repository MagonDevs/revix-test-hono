import { Hono } from "hono";
import {
  favouritesListOutputSchema,
  favouritesListQuerySchema,
  petIdParamsSchema,
} from "#contracts";
import { favouritesService } from "../../modules/favourites/index.js";
import { requireUser } from "../lib/guards.js";
import { parseParams, parseQuery } from "../lib/parse.js";
import { json, noContent, unwrap } from "../lib/respond.js";
import type { AppVariables } from "../context.js";

// Contract §8.5 as REST. Favouriting is a membership, so it is modelled
// as a resource under the caller: PUT adds, DELETE removes, and both are
// idempotent (R-18) — repeating either is 204, never 409. Neither needs a
// body: the verb *is* the new state.
//
// Every route is authenticated; there is no anonymous view of favourites.

export function createFavouritesRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/me/favourites", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { page, perPage } = parseQuery(c, favouritesListQuerySchema);
    const result = await favouritesService.list(db, caller.id, page, perPage);
    return json(c, favouritesListOutputSchema, unwrap(result));
  });

  app.put("/me/favourites/:petId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    unwrap(await favouritesService.set(db, caller.id, petId, true));
    return noContent(c);
  });

  app.delete("/me/favourites/:petId", async (c) => {
    const { db } = c.var.ctx;
    const caller = requireUser(c);
    const { petId } = parseParams(c, petIdParamsSchema);
    unwrap(await favouritesService.set(db, caller.id, petId, false));
    return noContent(c);
  });

  return app;
}
