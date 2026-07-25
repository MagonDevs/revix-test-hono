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

export const API_PREFIX = "/api/v1";

export function createApp() {
  const app = new Hono<{ Variables: AppVariables }>();
  const storage = new LocalStorageAdapter(env.STORAGE_LOCAL_DIR);

  app.use("*", requestId());
  app.use("*", loggerMiddleware());
  app.use("*", secureHeaders());
  app.use("*", cors({ origin: env.PUBLIC_ORIGIN, credentials: true }));
  app.onError(httpErrorHandler);

  app.route("/", createHealthRoutes(db));

  app.route(API_PREFIX, createUploadBytesRoute(db, storage));

  app.use(`${API_PREFIX}/*`, contextMiddleware(db));

  app.use(`${API_PREFIX}/*`, async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });

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
