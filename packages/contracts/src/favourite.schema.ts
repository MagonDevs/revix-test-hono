import { z } from "zod";
import { paginatedSchema, paginationInputSchema } from "./pagination.js";
import { petSchema } from "./pet.schema.js";

// §8.5 — favourites.list. Returns `Pet`, not a distinct Favourite entity
// (§6.8) — the pets are "in any status", deliberately, so a client can
// still show a favourited pet after it's adopted/withdrawn.
export const favouritesListInputSchema = paginationInputSchema.strict();
export type FavouritesListInput = z.infer<typeof favouritesListInputSchema>;

export const favouritesListOutputSchema = paginatedSchema(petSchema);
export type FavouritesListOutput = z.infer<typeof favouritesListOutputSchema>;

// §8.5 — favourites.set
export const favouritesSetInputSchema = z.strictObject({
  petId: z.uuid(),
  favourited: z.boolean(),
});
export type FavouritesSetInput = z.infer<typeof favouritesSetInputSchema>;

export const favouritesSetOutputSchema = z.object({
  petId: z.uuid(),
  favourited: z.boolean(),
});
export type FavouritesSetOutput = z.infer<typeof favouritesSetOutputSchema>;
