import { Hono } from "hono";
import { metaBreedsOutputSchema, metaBreedsQuerySchema } from "#contracts";
import { BREEDS_BY_SPECIES } from "../../modules/meta/index.js";
import { parseQuery } from "../lib/parse.js";
import { json } from "../lib/respond.js";
import type { AppVariables } from "../context.js";

// Contract §8.6 — a curated per-species suggestion list for a free-text
// combobox. Not authoritative: `pet.breed` accepts any string within its
// length limit. Sourced from modules/meta so the seeded pets and this
// endpoint can never drift apart, without production code depending on
// the seeder.

export function createMetaRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.get("/meta/breeds", (c) => {
    const { species } = parseQuery(c, metaBreedsQuerySchema);
    return json(c, metaBreedsOutputSchema, { items: BREEDS_BY_SPECIES[species] ?? [] });
  });

  return app;
}
