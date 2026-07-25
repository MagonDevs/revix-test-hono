import pino, { type Logger } from "pino";
import { env } from "../config/env.js";

export type { Logger };

// Architecture §8 — JSON in production, pretty in dev. A request-scoped
// child logger carries `requestId` and `userId` so every line inside a
// request is correlated without threading a parameter through the call
// stack.

export const rootLogger: Logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV !== "production"
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

export interface RequestLoggerContext {
  requestId: string;
  userId?: string | null;
}

/**
 * Builds a request-scoped child logger carrying `requestId` (and `userId`
 * once known). Intended to be created once per request and stashed on the
 * Hono context / tRPC context.
 */
export function createRequestLogger(ctx: RequestLoggerContext): Logger {
  return rootLogger.child({
    requestId: ctx.requestId,
    ...(ctx.userId !== undefined && ctx.userId !== null ? { userId: ctx.userId } : {}),
  });
}
