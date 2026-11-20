import { Hono } from "hono";
import { metaBreedsOutputSchema, metaBreedsQuerySchema, metaSpeciesOutputSchema } from "#contracts";
import { BREEDS_BY_SPECIES, SPECIES_CATALOGUE } from "../../modules/meta/index.js";
import { parseQuery } from "../lib/parse.js";
import { json } from "../lib/respond.js";
import type { AppVariables } from "../context.js";

export function createMetaRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/meta/breeds", (c) => {
    const { species } = parseQuery(c, metaBreedsQuerySchema);
    return json(c, metaBreedsOutputSchema, { items: BREEDS_BY_SPECIES[species] ?? [] });
  });

  app.get("/meta/species", (c) => {
    return json(c, metaSpeciesOutputSchema, { items: SPECIES_CATALOGUE });
  });

  return app;
}
