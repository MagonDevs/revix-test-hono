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
