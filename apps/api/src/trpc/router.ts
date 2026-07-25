import {
  authSessionOutputSchema,
  metaBreedsInputSchema,
  metaBreedsOutputSchema,
} from "@adopta/contracts";
import { usersRouter } from "../modules/users/index.js";
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

// Contract §8.1 — auth.session returns `SessionUser | null`. Never
// errors when anonymous: `ctx.user` is already the resolved SessionUser
// (or null), computed once in `createContext`, so this just reads it.
const authRouter = router({
  session: publicProcedure.output(authSessionOutputSchema).query(({ ctx }) => ctx.user),
});

export const appRouter = router({
  meta: metaRouter,
  users: usersRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
