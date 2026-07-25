import {
  adoptionRequestSchema,
  adoptionRequestsByIdInputSchema,
  adoptionRequestsCreateInputSchema,
  adoptionRequestsListInputSchema,
  adoptionRequestsListOutputSchema,
  adoptionRequestsRespondInputSchema,
  adoptionRequestsWithdrawInputSchema,
} from "@adopta/contracts";
import { protectedProcedure, router } from "../../trpc/init.js";
import { unwrap } from "../../trpc/unwrap.js";
import * as service from "./adoption-requests.service.js";

// Contract §8.4 — router -> service -> unwrap (architecture §2.1). All
// five procedures are protected: there is no anonymous view of a request.

export const adoptionRequestsRouter = router({
  create: protectedProcedure
    .input(adoptionRequestsCreateInputSchema)
    .output(adoptionRequestSchema)
    .mutation(async ({ ctx, input }) => unwrap(await service.create(ctx.db, ctx.user.id, input))),

  list: protectedProcedure
    .input(adoptionRequestsListInputSchema)
    .output(adoptionRequestsListOutputSchema)
    .query(async ({ ctx, input }) => unwrap(await service.list(ctx.db, ctx.user.id, input))),

  byId: protectedProcedure
    .input(adoptionRequestsByIdInputSchema)
    .output(adoptionRequestSchema)
    .query(async ({ ctx, input }) =>
      unwrap(await service.byId(ctx.db, ctx.user.id, input.requestId)),
    ),

  respond: protectedProcedure
    .input(adoptionRequestsRespondInputSchema)
    .output(adoptionRequestSchema)
    .mutation(async ({ ctx, input }) => unwrap(await service.respond(ctx.db, ctx.user.id, input))),

  withdraw: protectedProcedure
    .input(adoptionRequestsWithdrawInputSchema)
    .output(adoptionRequestSchema)
    .mutation(async ({ ctx, input }) =>
      unwrap(await service.withdraw(ctx.db, ctx.user.id, input.requestId)),
    ),
});
