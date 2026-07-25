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

// Architecture §5 / contract §7.1-7.3 — the REST face of authentication.
//
// Better Auth owns the credential handling, session rows and cookies, but
// its own HTTP surface is not exposed: its routes answer in its shape, not
// the contract's, and its sign-up response is a Better Auth user rather
// than a `SessionUser`. These four endpoints wrap it instead, so the
// client sees one consistent API — one error envelope, one user shape —
// and Better Auth's route layout stays an implementation detail we can
// change without breaking a client.
//
// The wrapping goes through `auth.handler()` rather than `auth.api.*`
// because the handler always answers with a `Response`: the Set-Cookie
// headers it sets are exactly the ones Better Auth wants on the wire and
// are copied across verbatim, and its failures arrive as a status+body to
// normalise rather than as a thrown library error to guess at.

const BETTER_AUTH_BASE = "/api/auth";

/**
 * Replays a validated request against Better Auth's own handler and hands
 * back the response plus its cookies. Client headers are forwarded so the
 * origin/CSRF checks and any existing session cookie still apply.
 */
async function callBetterAuth(
  c: { req: { raw: Request } },
  path: string,
  body: unknown,
): Promise<{ response: Response; setCookies: string[]; json: unknown }> {
  const headers = new Headers(c.req.raw.headers);
  headers.set("content-type", "application/json");
  // The forwarded body is re-serialised from the parsed value, so
  // content-length from the original request no longer applies.
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

/**
 * Copies Better Auth's Set-Cookie headers onto our own response. Appended
 * rather than set: sign-in emits more than one (session token and session
 * data), and overwriting would silently drop all but the last.
 */
function forwardCookies(
  c: { header: (k: string, v: string, o?: { append?: boolean }) => void },
  setCookies: string[],
): void {
  for (const cookie of setCookies) c.header("set-cookie", cookie, { append: true });
}

/** Reads the freshly authenticated user id out of Better Auth's response body. */
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

/**
 * Loads the contract's `SessionUser` for a just-authenticated id. Better
 * Auth's own user object is close but not identical (no `availablePetCount`,
 * different nullability), so the row is re-read through the users module
 * rather than reshaped from the auth response.
 */
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

  // Logging out is idempotent: a caller with no session still gets 204 and
  // the cookie-clearing headers, so a client can always reach a signed-out
  // state without first checking whether it was signed in.
  app.post("/auth/logout", async (c) => {
    const { response, setCookies } = await callBetterAuth(c, "/sign-out", {});
    if (response.ok) forwardCookies(c, setCookies);
    return noContent(c);
  });

  // 200 with the user, or 401 — never 200 with a null body, so a client
  // branches on the status alone.
  app.get("/auth/session", (c) => json(c, sessionUserSchema, requireUser(c)));

  return app;
}
