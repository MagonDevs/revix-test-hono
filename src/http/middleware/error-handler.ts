import type { Logger } from "../../lib/logger.js";
import type { ErrorHandler } from "hono";

/**
 * Hono's `onError` handler — for errors thrown outside tRPC (tRPC's own
 * errors are formatted by `trpc/init.ts`'s `errorFormatter` and never
 * reach this). Converts anything unhandled into the same `internal_error`
 * shape, without leaking a stack, cause, or internal detail. The detail
 * is logged server-side against the request id.
 */
export const httpErrorHandler: ErrorHandler<{
  Variables: { requestId: string; logger: Logger };
}> = (err, c) => {
  const requestId = c.var.requestId ?? "unknown";
  const logger = c.var.logger;
  logger?.error({ err, requestId }, "http.unhandled_error");

  return c.json(
    {
      error: {
        message: "Internal error",
        data: { appCode: "internal_error", requestId },
      },
    },
    500,
  );
};
