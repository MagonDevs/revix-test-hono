import { Hono } from "hono";
import { LIMITS } from "#contracts";
import { AppErrors } from "../../errors/app-error.js";
import { auth } from "../../modules/auth/index.js";
import { createUpload, getUploadBytes } from "../../modules/uploads/index.js";
import { toHttpErrorBody } from "../lib/http-error.js";
import type { Database } from "../../db/types.js";
import type { ImagePort } from "../../ports/image.port.js";
import type { StoragePort } from "../../ports/storage.port.js";
import type { AppVariables } from "../app.js";

// Contract §7.4-7.5 — plain HTTP, not tRPC. Architecture §7's pipeline:
// authenticate -> rate limit -> size guard -> sniff -> sharp normalise
// -> StoragePort.put -> insert -> Upload shape.
//
// `db`/`storage`/`image` are injected rather than constructed here — an
// ordinary route file must not import `db` or `adapters` directly
// (architecture §2.1); the composition root (`http/app.ts`) builds the
// concrete instances and passes them in.

export interface UploadsRoutesDeps {
  db: Database;
  storage: StoragePort;
  image: ImagePort;
}

// Per-user 30/hour limiter (contract §7.4). The existing
// `rate-limit.middleware.ts` is IP-keyed only and runs before auth is
// resolved; this needs the authenticated user id, so it's a small
// dedicated in-memory fixed-window limiter checked after
// `auth.api.getSession`, same shape/caveats as the B2 IP limiter
// (single-process, not safe across replicas — B9 scope).
const uploadHits = new Map<string, { count: number; resetAt: number }>();
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_MAX_PER_HOUR = 30;

function checkUploadRateLimit(userId: string): number | null {
  const now = Date.now();
  const entry = uploadHits.get(userId);
  if (!entry || entry.resetAt <= now) {
    uploadHits.set(userId, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
    return null;
  }
  entry.count += 1;
  if (entry.count > UPLOAD_MAX_PER_HOUR) {
    return Math.ceil((entry.resetAt - now) / 1000);
  }
  return null;
}

export function createUploadsRoutes(deps: UploadsRoutesDeps) {
  const { db, storage, image } = deps;
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/api/uploads", async (c) => {
    const requestId = c.var.requestId ?? "unknown";

    const session = await auth.api.getSession({ headers: c.req.raw.headers }).catch(() => null);
    if (!session?.user) {
      const { status, body } = toHttpErrorBody(AppErrors.unauthenticated(), requestId);
      return c.json(body, status as 401);
    }

    const retryAfterSeconds = checkUploadRateLimit(session.user.id);
    if (retryAfterSeconds !== null) {
      c.header("Retry-After", String(retryAfterSeconds));
      const { status, body } = toHttpErrorBody(AppErrors.rateLimited(retryAfterSeconds), requestId);
      return c.json(body, status as 429);
    }

    // Size guard from content-length before touching the body (architecture
    // §7 step 3). `formData()` still parses the whole body into memory —
    // a fully streamed guard would need a manual multipart parser, out of
    // scope here — but nothing over the limit is ever handed to sharp.
    const declaredLength = c.req.header("content-length");
    if (declaredLength && Number(declaredLength) > LIMITS.upload.maxBytes * 2) {
      // *2: multipart framing (boundary/headers) adds overhead on top of
      // the file bytes themselves; the exact post-parse file size is
      // re-checked below regardless.
      const { status, body } = toHttpErrorBody(
        AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`),
        requestId,
      );
      return c.json(body, status as 400);
    }

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      const { status, body } = toHttpErrorBody(
        AppErrors.invalidField("file", "Invalid multipart/form-data body"),
        requestId,
      );
      return c.json(body, status as 400);
    }

    const entries = formData.getAll("file");
    const file = entries[0];
    if (entries.length !== 1 || !(file instanceof File)) {
      const { status, body } = toHttpErrorBody(
        AppErrors.invalidField("file", "Exactly one file field named 'file' is required"),
        requestId,
      );
      return c.json(body, status as 400);
    }

    if (file.size > LIMITS.upload.maxBytes) {
      const { status, body } = toHttpErrorBody(
        AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`),
        requestId,
      );
      return c.json(body, status as 400);
    }

    const bytes = new Uint8Array(await file.arrayBuffer());

    const result = await createUpload(
      db,
      { storage, image, now: () => new Date() },
      { uploaderId: session.user.id, bytes },
    );

    if (result.isErr()) {
      const { status, body } = toHttpErrorBody(result.error, requestId);
      return c.json(body, status as 400 | 401 | 403 | 404 | 409 | 429 | 500);
    }

    return c.json(result.value, 201);
  });

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  app.get("/api/uploads/:uploadId/raw", async (c) => {
    const uploadId = c.req.param("uploadId");
    if (!UUID_RE.test(uploadId)) return c.notFound();

    const found = await getUploadBytes(db, storage, uploadId);
    if (!found) return c.notFound();

    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Type", found.mimeType);
    return c.body(found.bytes as unknown as ArrayBuffer);
  });

  return app;
}
