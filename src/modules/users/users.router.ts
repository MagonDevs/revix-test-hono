import {
  sessionUserSchema,
  userProfileSchema,
  usersByIdInputSchema,
  usersUpdateMeInputSchema,
} from "#contracts";
import { protectedProcedure, publicProcedure, router } from "../../trpc/init.js";
import { unwrap } from "../../trpc/unwrap.js";
import * as service from "./users.service.js";

// Contract §8.2 — router -> service -> repository (architecture §6).

export const usersRouter = router({
  byId: publicProcedure
    .input(usersByIdInputSchema)
    .output(userProfileSchema)
    .query(async ({ ctx, input }) => unwrap(await service.getUserProfile(ctx.db, input.userId))),

  updateMe: protectedProcedure
    .input(usersUpdateMeInputSchema)
    .output(sessionUserSchema)
    .mutation(async ({ ctx, input }) => unwrap(await service.updateMe(ctx.db, ctx.user.id, input))),
});
