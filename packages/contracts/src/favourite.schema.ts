import { z } from "zod";
import { paginationInputSchema } from "./pagination.js";

// §8.5 — favourites.list
export const favouritesListInputSchema = paginationInputSchema.strict();
export type FavouritesListInput = z.infer<typeof favouritesListInputSchema>;

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
