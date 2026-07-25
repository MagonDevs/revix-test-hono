import {
  favouritesListInputSchema,
  favouritesListOutputSchema,
  favouritesSetInputSchema,
  favouritesSetOutputSchema,
} from "@adopta/contracts";
import { protectedProcedure, router } from "../../trpc/init.js";
import { unwrap } from "../../trpc/unwrap.js";
import * as service from "./favourites.service.js";

// Contract §8.5 — router -> service -> unwrap (architecture §2.1). Both
// procedures are protected: favourites are per-user, no anonymous view.

export const favouritesRouter = router({
  list: protectedProcedure
    .input(favouritesListInputSchema)
    .output(favouritesListOutputSchema)
    .query(async ({ ctx, input }) =>
      unwrap(await service.list(ctx.db, ctx.user.id, input.page, input.perPage)),
    ),

  set: protectedProcedure
    .input(favouritesSetInputSchema)
    .output(favouritesSetOutputSchema)
    .mutation(async ({ ctx, input }) =>
      unwrap(await service.set(ctx.db, ctx.user.id, input.petId, input.favourited)),
    ),
});
