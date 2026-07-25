import { z } from "zod";
import { speciesSchema } from "./enums.js";

// §8.6 — meta.breeds
export const metaBreedsInputSchema = z.strictObject({
  species: speciesSchema,
});
export type MetaBreedsInput = z.infer<typeof metaBreedsInputSchema>;

export const metaBreedsOutputSchema = z.object({
  items: z.array(z.string()),
});
export type MetaBreedsOutput = z.infer<typeof metaBreedsOutputSchema>;
