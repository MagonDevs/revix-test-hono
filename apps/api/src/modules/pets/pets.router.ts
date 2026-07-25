import {
  petsByIdInputSchema,
  petsListByOwnerInputSchema,
  petsListByOwnerOutputSchema,
  petsListInputSchema,
  petsListMineInputSchema,
  petsListMineOutputSchema,
  petsListOutputSchema,
  petSchema,
} from "@adopta/contracts";
import { protectedProcedure, publicProcedure, router } from "../../trpc/init.js";
import { unwrap } from "../../trpc/unwrap.js";
import * as service from "./pets.service.js";

// Contract §8.3 — router -> service -> unwrap (architecture §2.1). No
// logic beyond input -> service -> unwrap.

export const petsRouter = router({
  list: publicProcedure
    .input(petsListInputSchema)
    .output(petsListOutputSchema)
    .query(async ({ ctx, input }) =>
      unwrap(await service.list(ctx.db, input, ctx.user?.id ?? null)),
    ),

  byId: publicProcedure
    .input(petsByIdInputSchema)
    .output(petSchema)
    .query(async ({ ctx, input }) =>
      unwrap(await service.byId(ctx.db, input.petId, ctx.user?.id ?? null)),
    ),

  listByOwner: publicProcedure
    .input(petsListByOwnerInputSchema)
    .output(petsListByOwnerOutputSchema)
    .query(async ({ ctx, input }) =>
      unwrap(await service.listByOwner(ctx.db, input, ctx.user?.id ?? null)),
    ),

  listMine: protectedProcedure
    .input(petsListMineInputSchema)
    .output(petsListMineOutputSchema)
    .query(async ({ ctx, input }) => unwrap(await service.listMine(ctx.db, ctx.user.id, input))),
});
