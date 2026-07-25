import { createRequestLogger, type Logger } from "../../lib/logger.js";
import type { MiddlewareHandler } from "hono";

export function loggerMiddleware(): MiddlewareHandler<{
  Variables: { requestId: string; logger: Logger };
}> {
  return async (c, next) => {
    const logger = createRequestLogger({ requestId: c.var.requestId });
    c.set("logger", logger);

    const start = Date.now();
    await next();
    const ms = Date.now() - start;

    logger.info(
      { method: c.req.method, path: c.req.path, status: c.res.status, ms },
      "http.request",
    );
  };
}
