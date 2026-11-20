import { z } from "zod";
import { speciesSchema } from "./enums.js";

export const metaBreedsQuerySchema = z.object({
  species: speciesSchema,
});
export type MetaBreedsInput = z.infer<typeof metaBreedsQuerySchema>;

export const metaBreedsOutputSchema = z.object({
  items: z.array(z.string()),
});
export type MetaBreedsOutput = z.infer<typeof metaBreedsOutputSchema>;

export const metaSpeciesItemSchema = z.object({
  value: speciesSchema,
  label: z.string(),
});
export type MetaSpeciesItem = z.infer<typeof metaSpeciesItemSchema>;

export const metaSpeciesOutputSchema = z.object({
  items: z.array(metaSpeciesItemSchema),
});
export type MetaSpeciesOutput = z.infer<typeof metaSpeciesOutputSchema>;
