import { authSessionOutputSchema, metaBreedsInputSchema, metaBreedsOutputSchema } from "#contracts";
import { adoptionRequestsRouter } from "../modules/adoption-requests/index.js";
import { favouritesRouter } from "../modules/favourites/index.js";
import { BREEDS_BY_SPECIES } from "../modules/meta/index.js";
import { petsRouter } from "../modules/pets/index.js";
import { usersRouter } from "../modules/users/index.js";
import { publicProcedure, router } from "./init.js";

// Curated per-species suggestion list for a free-text combobox (contract
// §8.6). Not authoritative — `pet.breed` accepts any string within its
// length limit. Sourced from modules/meta so the seeded pets and this
// endpoint never drift apart, without production code depending on the
// seeder (B4).

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
  pets: petsRouter,
  adoptionRequests: adoptionRequestsRouter,
  favourites: favouritesRouter,
  auth: authRouter,
});

export type AppRouter = typeof appRouter;
