import { metaBreedsInputSchema, metaBreedsOutputSchema } from "@adopta/contracts";
import { publicProcedure, router } from "./init.js";

// Curated per-species suggestion list for a free-text combobox (contract
// §8.6). Not authoritative — `pet.breed` accepts any string within its
// length limit. Full curated lists are seeding/B4 scope; this is a stub
// that proves the router works end-to-end.
const BREEDS_BY_SPECIES: Record<string, string[]> = {
  dog: ["Labrador Retriever", "German Shepherd", "Poodle", "Bulldog"],
  cat: ["Domestic Shorthair", "Siamese", "Maine Coon"],
  rabbit: ["Holland Lop", "Netherland Dwarf"],
  bird: ["Budgerigar", "Cockatiel"],
  other: [],
};

const metaRouter = router({
  breeds: publicProcedure
    .input(metaBreedsInputSchema)
    .output(metaBreedsOutputSchema)
    .query(({ input }) => {
      return { items: BREEDS_BY_SPECIES[input.species] ?? [] };
    }),
});

export const appRouter = router({
  meta: metaRouter,
});

export type AppRouter = typeof appRouter;
