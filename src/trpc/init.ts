import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { AppErrors } from "../errors/app-error.js";
import { AppErrorCause, appErrorToTRPCError } from "./unwrap.js";
import type { ErrorData } from "#contracts";
import type { Context } from "./context.js";
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

// Architecture §4/§8 — an unexpected throw is logged with the stack and
// the *scrubbed* input, never the raw input. Scrubbing removes anything
// named like a password, token, cookie or secret before it reaches a log
// line, recursively, so a nested field (e.g. `credentials.password`) is
// caught too.
const SENSITIVE_KEY = /password|token|cookie|secret/i;

function scrubInput(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubInput);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [
        key,
        SENSITIVE_KEY.test(key) ? "[scrubbed]" : scrubInput(v),
      ]),
    );
  }
  return value;
}

/**
 * Logs `{ path, type, ms, userId }` for every procedure call, and — only
 * when the call ended in an `internal_error` (an unexpected throw, not a
 * declared `AppError`) — an additional `trpc.unhandled_error` line with
 * the stack and the scrubbed input, against the same request id.
 */
const timingMiddleware = t.middleware(async ({ path, type, ctx, next, getRawInput }) => {
  const start = Date.now();
  const result = await next();
  const ms = Date.now() - start;
  ctx.logger.info({ path, type, ms, userId: ctx.user?.id ?? null }, "trpc.call");

  if (!result.ok) {
    const cause = result.error.cause;
    const appError = cause instanceof AppErrorCause ? cause.appError : undefined;
    if (!appError || appError.code === "internal_error") {
      const rawInput = await getRawInput().catch(() => undefined);
      ctx.logger.error(
        {
          path,
          type,
          ms,
          userId: ctx.user?.id ?? null,
          requestId: ctx.requestId,
          input: scrubInput(rawInput),
          err: result.error,
        },
        "trpc.unhandled_error",
      );
    }
  }

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

// B9 — request-creation rate limit (build-plan B9, architecture §11: "rate
// limits on auth, uploads and request creation"). `adoptionRequests.create`
// is a tRPC mutation, not a plain HTTP route, so the Hono-level
// `rate-limit.middleware.ts` (mounted on `/api/auth/*`) can't reach it —
// this is the tRPC-procedure equivalent, keyed by the authenticated user
// id (not IP: several adopters can share a NAT/office IP, and the id is
// already known here via `requireSession`). 20/hour is not specified by
// the contract; picked as a generous ceiling for a real adopter's
// legitimate browsing-and-requesting session while still blocking a
// scripted flood — well above the ~1-5 requests a genuine user sends per
// hour, well below what a burst would need to do damage. Same
// single-process/in-memory caveat as the other B2/B6 limiters (documented
// there): not safe across multiple replicas, real store is out of scope
// for this exercise.
const REQUEST_CREATE_WINDOW_MS = 60 * 60 * 1000;
const REQUEST_CREATE_MAX_PER_HOUR = 20;
const requestCreateHits = new Map<string, { count: number; resetAt: number }>();

const rateLimitRequestCreate = t.middleware(({ ctx, next }) => {
  // Chained only after `requireSession` (see `rateLimitedProtectedProcedure`
  // below), which already throws `unauthenticated` when `ctx.user` is
  // null — but `t.middleware` doesn't see that narrowing from a sibling
  // middleware's type, so this repeats the same guard defensively.
  if (!ctx.user) {
    throw appErrorToTRPCError(AppErrors.unauthenticated());
  }
  const userId = ctx.user.id;

  const now = Date.now();
  const entry = requestCreateHits.get(userId);

  if (!entry || entry.resetAt <= now) {
    requestCreateHits.set(userId, { count: 1, resetAt: now + REQUEST_CREATE_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > REQUEST_CREATE_MAX_PER_HOUR) {
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    throw appErrorToTRPCError(AppErrors.rateLimited(retryAfterSeconds));
  }

  return next();
});

export const rateLimitedProtectedProcedure = protectedProcedure.use(rateLimitRequestCreate);
