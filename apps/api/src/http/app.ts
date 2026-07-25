import { trpcServer } from "@hono/trpc-server";
import { Hono, type Context as HonoContext } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { createContext } from "../trpc/context.js";
import { appRouter } from "../trpc/router.js";
import { httpErrorHandler } from "./middleware/error-handler.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { rateLimit } from "./middleware/rate-limit.middleware.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { createAuthRoutes } from "./routes/auth.route.js";
import { createHealthRoutes } from "./routes/health.route.js";
import { createUploadsRoutes } from "./routes/uploads.route.js";
import type { Logger } from "../lib/logger.js";

// Architecture §3 — Hono composition. Middleware order is load-bearing:
// request id before logging, CORS before the auth handler, rate limit
// before the handler it protects.

export interface AppVariables {
  requestId: string;
  logger: Logger;
}

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.use("*", requestId());
  app.use("*", loggerMiddleware());
  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.PUBLIC_ORIGIN, credentials: true }));
  app.onError(httpErrorHandler);

  app.route("/", createHealthRoutes(db));

  // Auth mount point (B3): Better Auth's handler + error normalisation
  // (contract §7.1-7.3, 50 req/15min/IP per contract §7).
  app.use("/api/auth/*", rateLimit({ window: "15m", max: 50, by: "ip" }));
  app.route("/", createAuthRoutes());

  // Uploads (B6): contract §7.4-7.5, plain HTTP not tRPC.
  app.route("/", createUploadsRoutes());

  // `Cache-Control: private, no-store` on every /trpc response (contract
  // §2). Set before the trpcServer middleware runs so it applies
  // regardless of the outcome.
  app.use("/trpc/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });

  app.use(
    "/trpc/*",
    trpcServer({
      endpoint: "/trpc",
      router: appRouter,
      // `@hono/trpc-server` types `createContext` as returning a plain
      // `Record<string, unknown>`; our `Context` (architecture §3.1) is a
      // concrete interface, not an index signature. The cast is safe —
      // the shape is exact, tRPC only needs it structurally.
      createContext: async (_opts, c) =>
        (await createContext(c as HonoContext<{ Variables: AppVariables }>)) as unknown as Record<
          string,
          unknown
        >,
    }),
  );

  return app;
}

export const app = createApp();
