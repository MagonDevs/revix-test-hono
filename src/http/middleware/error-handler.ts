import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import { toHttpErrorBody } from "../lib/http-error.js";
import type { AppVariables } from "../context.js";
import type { ErrorHandler } from "hono";

export const httpErrorHandler: ErrorHandler<{ Variables: AppVariables }> = (err, c) => {
  const requestId = c.var.requestId ?? "unknown";
  const appError = err instanceof DomainThrow ? err.appError : toAppError(err);

  if (appError.code === "internal_error") {
    c.var.logger?.error(
      {
        err,
        requestId,
        method: c.req.method,
        path: c.req.path,
        userId: c.var.ctx?.user?.id ?? null,
        input: c.var.scrubbedBody,
      },
      "http.unhandled_error",
    );
  }

  if (appError.code === "rate_limited") {
    c.header("Retry-After", String(appError.retryAfterSeconds));
  }

  const { status, body } = toHttpErrorBody(appError, requestId);
  return c.json(body, status);
};
