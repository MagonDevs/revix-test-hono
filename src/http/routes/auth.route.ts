import { Hono } from "hono";
import { loginRequestSchema, registerRequestSchema, sessionUserSchema } from "#contracts";
import { env } from "../../config/env.js";
import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { auth, normaliseBetterAuthError } from "../../modules/auth/index.js";
import { countAvailablePets, findUserById, mapSessionUser } from "../../modules/users/index.js";
import { requireUser } from "../lib/guards.js";
import { parseBody } from "../lib/parse.js";
import { json, noContent } from "../lib/respond.js";
import type { Database } from "../../db/types.js";
import type { AppVariables } from "../context.js";

const BETTER_AUTH_BASE = "/api/auth";

async function callBetterAuth(
  c: { req: { raw: Request } },
  path: string,
  body: unknown,
): Promise<{ response: Response; setCookies: string[]; json: unknown }> {
  const headers = new Headers(c.req.raw.headers);
  headers.set("content-type", "application/json");
  headers.delete("content-length");

  const response = await auth.handler(
    new Request(new URL(`${BETTER_AUTH_BASE}${path}`, env.PUBLIC_ORIGIN), {
      method: "POST",
      headers,
      body: JSON.stringify(body ?? {}),
    }),
  );

  const parsed: unknown = await response
    .clone()
    .json()
    .catch(() => null);

  return { response, setCookies: response.headers.getSetCookie(), json: parsed };
}

function forwardCookies(
  c: { header: (k: string, v: string, o?: { append?: boolean }) => void },
  setCookies: string[],
): void {
  for (const cookie of setCookies) c.header("set-cookie", cookie, { append: true });
}

function userIdFrom(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "user" in body) {
    const user = body.user;
    if (typeof user === "object" && user !== null && "id" in user) {
      const id = user.id;
      if (typeof id === "string") return id;
    }
  }
  return null;
}

async function loadSessionUser(db: Database, userId: string) {
  const row = await findUserById(db, userId);
  if (!row) throw new DomainThrow(AppErrors.internal("Authenticated user row not found"));
  return mapSessionUser(row, await countAvailablePets(db, row.id));
}

export function createAuthRoutes() {
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/auth/register", async (c) => {
    const body = await parseBody(c, registerRequestSchema);
    const {
      response,
      setCookies,
      json: authBody,
    } = await callBetterAuth(c, "/sign-up/email", body);

    if (!response.ok) {
      throw new DomainThrow(
        normaliseBetterAuthError({
          path: `${BETTER_AUTH_BASE}/sign-up/email`,
          status: response.status,
          body: authBody,
        }),
      );
    }

    const userId = userIdFrom(authBody);
    if (!userId) throw new DomainThrow(AppErrors.internal("Sign-up returned no user"));

    forwardCookies(c, setCookies);
    return json(c, sessionUserSchema, await loadSessionUser(c.var.ctx.db, userId), 201);
  });

  app.post("/auth/login", async (c) => {
    const body = await parseBody(c, loginRequestSchema);
    const {
      response,
      setCookies,
      json: authBody,
    } = await callBetterAuth(c, "/sign-in/email", body);

    if (!response.ok) {
      throw new DomainThrow(
        normaliseBetterAuthError({
          path: `${BETTER_AUTH_BASE}/sign-in/email`,
          status: response.status,
          body: authBody,
        }),
      );
    }

    const userId = userIdFrom(authBody);
    if (!userId) throw new DomainThrow(AppErrors.internal("Sign-in returned no user"));

    forwardCookies(c, setCookies);
    return json(c, sessionUserSchema, await loadSessionUser(c.var.ctx.db, userId));
  });

  app.post("/auth/logout", async (c) => {
    const { response, setCookies } = await callBetterAuth(c, "/sign-out", {});
    if (response.ok) forwardCookies(c, setCookies);
    return noContent(c);
  });

  app.get("/auth/session", (c) => json(c, sessionUserSchema, requireUser(c)));

  return app;
}
