import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { LocalStorageAdapter } from "../adapters/local-storage.adapter.js";
import { SharpImageAdapter } from "../adapters/sharp.adapter.js";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { contextMiddleware } from "./context.js";
import { httpErrorHandler } from "./middleware/error-handler.js";
import { loggerMiddleware } from "./middleware/logger.middleware.js";
import { rateLimit } from "./middleware/rate-limit.middleware.js";
import { requestId } from "./middleware/request-id.middleware.js";
import { createAdoptionRequestsRoutes } from "./routes/adoption-requests.route.js";
import { createAuthRoutes } from "./routes/auth.route.js";
import { createFavouritesRoutes } from "./routes/favourites.route.js";
import { createHealthRoutes } from "./routes/health.route.js";
import { createMetaRoutes } from "./routes/meta.route.js";
import { createPetsRoutes } from "./routes/pets.route.js";
import { createUploadBytesRoute, createUploadsRoutes } from "./routes/uploads.route.js";
import { createUsersRoutes } from "./routes/users.route.js";
import type { AppVariables } from "./context.js";

// Architecture §3 — Hono composition. Middleware order is load-bearing:
// request id before logging, CORS before anything that sets a cookie,
// rate limit before the handler it protects, and the context (which
// resolves the session) before any route that reads `c.var.ctx`.
//
// This file is the composition root for `http/**` (architecture §2.1): the
// one place under `http/` allowed to construct concrete `db`/adapter
// instances and wire them into route factories — ordinary route files
// receive them by injection instead.

/** Every versioned endpoint lives under this prefix; `/health` does not. */
export const API_PREFIX = "/api/v1";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  const storage = new LocalStorageAdapter(env.STORAGE_LOCAL_DIR);

  app.use("*", requestId());
  app.use("*", loggerMiddleware());
  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.PUBLIC_ORIGIN, credentials: true }));
  app.onError(httpErrorHandler);

  // Liveness/readiness sit outside the API version: an orchestrator
  // probing them must not be coupled to the client-facing contract.
  app.route("/", createHealthRoutes(db));

  // Registered before the context middleware so photo bytes are served
  // without a session lookup — Hono matches in registration order, and
  // this handler answers without ever reaching the middleware below.
  app.route(API_PREFIX, createUploadBytesRoute(db, storage));

  app.use(`${API_PREFIX}/*`, contextMiddleware(db));

  // Every API response is caller-specific (`isFavourited`,
  // `viewerRequestStatus`, and the whole authenticated surface), so none
  // of it may be cached by a shared proxy (contract §2). Set after the
  // handler runs so it applies regardless of the outcome. The raw-bytes
  // route above is the deliberate exception — it sets its own immutable
  // caching and never passes through here.
  app.use(`${API_PREFIX}/*`, async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });

  // Auth: 50 req/15min/IP (contract §7). IP-keyed because the caller has
  // no identity yet.
  app.use(`${API_PREFIX}/auth/*`, rateLimit({ window: "15m", max: 50, by: "ip" }));

  app.route(API_PREFIX, createAuthRoutes());
  app.route(API_PREFIX, createMetaRoutes());
  app.route(API_PREFIX, createUsersRoutes());
  app.route(API_PREFIX, createPetsRoutes());
  app.route(API_PREFIX, createAdoptionRequestsRoutes());
  app.route(API_PREFIX, createFavouritesRoutes());
  app.route(API_PREFIX, createUploadsRoutes({ storage, image: new SharpImageAdapter() }));

  return app;
}

export const app = createApp();
