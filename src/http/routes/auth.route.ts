import { Hono } from "hono";
import { auth, normaliseBetterAuthError } from "../../modules/auth/index.js";
import type { AppVariables } from "../app.js";

// Architecture §5 / contract §7.1-7.3 — mounts Better Auth's own handler
// and intercepts non-2xx responses to rewrite them into the standard
// AppError shape before they reach the client. Successful responses
// (including Set-Cookie) pass through untouched.

export function createAuthRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.all("/api/auth/*", async (c) => {
    const res = await auth.handler(c.req.raw);

    if (res.ok) return res;

    let body: unknown = null;
    try {
      body = await res.clone().json();
    } catch {
      body = null;
    }

    const requestId = c.var.requestId ?? "unknown";
    const normalised = normaliseBetterAuthError({
      path: c.req.path,
      status: res.status,
      body,
      requestId,
    });

    return c.json(normalised.body, normalised.status as 401 | 409 | 500);
  });

  return app;
}
