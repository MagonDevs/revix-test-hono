import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { AppErrors } from "../errors/app-error.js";
import { AppErrorCause, appErrorToTRPCError } from "./unwrap.js";
import type { Context } from "./context.js";
import type { ErrorData } from "@adopta/contracts";
import type { TRPCError } from "@trpc/server";

// Architecture §3.1 — tRPC foundation: superjson transformer, the
// errorFormatter producing the contract's error data shape (§5.3), and
// the procedure builders.

/**
 * Pulls the AppError back out of a TRPCError's `cause` (attached by
 * `unwrap.ts`'s `appErrorToTRPCError`) and maps it onto the contract's
 * `ErrorData` fields. Falls back to `internal_error` with no extra detail
 * for errors that didn't originate from an AppError (e.g. a Zod parse
 * failure raised by tRPC itself before a procedure ran, or an unhandled
 * throw inside a procedure).
 */
function errorDataFrom(error: TRPCError): Omit<ErrorData, "requestId"> {
  const cause = error.cause;
  const appError = cause instanceof AppErrorCause ? cause.appError : undefined;

  if (appError) {
    switch (appError.code) {
      case "validation_error":
        return { appCode: "validation_error", fieldErrors: appError.fieldErrors };
      case "conflict":
        return { appCode: "conflict", conflictReason: appError.reason };
      case "rate_limited":
        return { appCode: "rate_limited", retryAfterSeconds: appError.retryAfterSeconds };
      case "unauthenticated":
      case "forbidden":
      case "not_found":
      case "internal_error":
        return { appCode: appError.code };
    }
  }

  // Zod input validation failures surface as BAD_REQUEST with a
  // ZodError cause before ever reaching a procedure body — translate
  // them into fieldErrors with the input schema's own dot paths.
  if (error.code === "BAD_REQUEST" && isZodError(cause)) {
    return {
      appCode: "validation_error",
      fieldErrors: cause.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    };
  }

  return { appCode: "internal_error" };
}

function isZodError(
  value: unknown,
): value is { issues: Array<{ path: PropertyKey[]; message: string }> } {
  return (
    typeof value === "object" && value !== null && "issues" in value && Array.isArray(value.issues)
  );
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error, ctx }) {
    // Built explicitly rather than spread from `shape.data` — tRPC's
    // default shape includes a `stack` field outside production, and
    // architecture §4 / contract §5.3 require that no internal detail
    // (stack, cause, SQL fragment, or the underlying exception's own
    // message) ever reaches the wire, in any environment.
    const data = {
      code: shape.data.code,
      httpStatus: shape.data.httpStatus,
      path: shape.data.path,
      ...errorDataFrom(error),
      requestId: ctx?.requestId ?? "unknown",
    };
    return {
      ...shape,
      message: data.appCode === "internal_error" ? "Internal error" : shape.message,
      data,
    };
  },
});

export const router = t.router;
export const middleware = t.middleware;

/** Logs `{ path, type, ms, userId }` for every procedure call. */
const timingMiddleware = t.middleware(async ({ path, type, ctx, next }) => {
  const start = Date.now();
  const result = await next();
  const ms = Date.now() - start;
  ctx.logger.info({ path, type, ms, userId: ctx.user?.id ?? null }, "trpc.call");
  return result;
});

export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Throws `unauthenticated` when `ctx.user` is null, and narrows `ctx.user`
 * to non-nullable for every downstream procedure — so no protected
 * procedure needs its own null check.
 */
const requireSession = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw appErrorToTRPCError(AppErrors.unauthenticated());
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = publicProcedure.use(requireSession);
