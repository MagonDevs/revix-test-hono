import pino, { type Logger } from "pino";
import { env } from "../config/env.js";

export type { Logger };

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

export function createRequestLogger(ctx: RequestLoggerContext): Logger {
  return rootLogger.child({
    requestId: ctx.requestId,
    ...(ctx.userId !== undefined && ctx.userId !== null ? { userId: ctx.userId } : {}),
  });
}
