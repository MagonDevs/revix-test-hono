import { protectedProcedure, publicProcedure, router } from "../../trpc/init.js";
import { unwrap } from "../../trpc/unwrap.js";
import * as service from "./pets.service.js";
import {
  petsByIdInputSchema,
  petsCreateInputSchema,
  petsListByOwnerInputSchema,
  petsListByOwnerOutputSchema,
  petsListInputSchema,
  petsListMineInputSchema,
  petsListMineOutputSchema,
  petsListOutputSchema,
  petsRemoveInputSchema,
  petsRemoveOutputSchema,
  petsSetStatusInputSchema,
  petsUpdateInputSchema,
  petSchema,
} from "#contracts";

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

  create: protectedProcedure
    .input(petsCreateInputSchema)
    .output(petSchema)
    .mutation(async ({ ctx, input }) => unwrap(await service.create(ctx.db, ctx.user.id, input))),

  update: protectedProcedure
    .input(petsUpdateInputSchema)
    .output(petSchema)
    .mutation(async ({ ctx, input }) => unwrap(await service.update(ctx.db, ctx.user.id, input))),

  setStatus: protectedProcedure
    .input(petsSetStatusInputSchema)
    .output(petSchema)
    .mutation(async ({ ctx, input }) =>
      unwrap(await service.setStatus(ctx.db, ctx.user.id, input)),
    ),

  remove: protectedProcedure
    .input(petsRemoveInputSchema)
    .output(petsRemoveOutputSchema)
    .mutation(async ({ ctx, input }) =>
      unwrap(await service.remove(ctx.db, ctx.user.id, input.petId)),
    ),
});
