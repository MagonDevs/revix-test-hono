import { paginatedSchema, paginationQuerySchema } from "./pagination.js";
import { petSchema } from "./pet.schema.js";
import type { z } from "zod";

// GET /me/favourites. Returns `Pet`, not a distinct Favourite entity
// (§6.8) — the pets come back "in any status", deliberately, so a client
// can still show a favourited pet after it's adopted or withdrawn.
export const favouritesListQuerySchema = paginationQuerySchema;
export type FavouritesListInput = z.infer<typeof favouritesListQuerySchema>;

export const favouritesListOutputSchema = paginatedSchema(petSchema);
export type FavouritesListOutput = z.infer<typeof favouritesListOutputSchema>;

// PUT / DELETE /me/favourites/:petId. Both are idempotent and answer 204
// with no body — the favourited state is implied by the verb, so there is
// nothing left to echo back.
export interface FavouritesSetOutput {
  petId: string;
  favourited: boolean;
}
