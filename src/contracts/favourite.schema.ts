import { paginatedSchema, paginationQuerySchema } from "./pagination.js";
import { petSchema } from "./pet.schema.js";
import type { z } from "zod";

export const favouritesListQuerySchema = paginationQuerySchema;
export type FavouritesListInput = z.infer<typeof favouritesListQuerySchema>;

export const favouritesListOutputSchema = paginatedSchema(petSchema);
export type FavouritesListOutput = z.infer<typeof favouritesListOutputSchema>;

export interface FavouritesSetOutput {
  petId: string;
  favourited: boolean;
}
