import { Hono } from "hono";
import { LIMITS, uploadIdParamsSchema, uploadSchema } from "#contracts";
import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { createUpload, getUploadBytes } from "../../modules/uploads/index.js";
import { requireUser } from "../lib/guards.js";
import { json, unwrap } from "../lib/respond.js";
import { userRateLimit } from "../middleware/user-rate-limit.middleware.js";
import type { Database } from "../../db/types.js";
import type { ImagePort } from "../../ports/image.port.js";
import type { StoragePort } from "../../ports/storage.port.js";
import type { AppVariables } from "../context.js";

// Contract §7.4-7.5 — architecture §7's pipeline: authenticate -> rate
// limit -> size guard -> sniff -> sharp normalise -> StoragePort.put ->
// insert -> Upload shape.
//
// `storage`/`image` are injected rather than constructed here — an
// ordinary route file must not import `db` or `adapters` directly
// (architecture §2.1); the composition root (`http/app.ts`) builds the
// concrete instances and passes them in.

export interface UploadsRoutesDeps {
  storage: StoragePort;
  image: ImagePort;
}

const UPLOAD_LIMIT = { window: "1h", max: 30, bucket: "upload-create" } as const;

export function createUploadsRoutes(deps: UploadsRoutesDeps) {
  const { storage, image } = deps;
  const app = new Hono<{ Variables: AppVariables }>();

  app.post("/uploads", userRateLimit(UPLOAD_LIMIT), async (c) => {
    const { db, now } = c.var.ctx;
    const caller = requireUser(c);

    // Size guard from content-length before touching the body
    // (architecture §7 step 3). `formData()` still parses the whole body
    // into memory — a fully streamed guard would need a manual multipart
    // parser, out of scope here — but nothing over the limit is ever
    // handed to sharp.
    //
    // *2: multipart framing (boundary/headers) adds overhead on top of
    // the file bytes themselves; the exact post-parse file size is
    // re-checked below regardless.
    const declaredLength = c.req.header("content-length");
    if (declaredLength && Number(declaredLength) > LIMITS.upload.maxBytes * 2) {
      throw new DomainThrow(
        AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`),
      );
    }

    let formData: FormData;
    try {
      formData = await c.req.raw.formData();
    } catch {
      throw new DomainThrow(AppErrors.invalidField("file", "Invalid multipart/form-data body"));
    }

    const entries = formData.getAll("file");
    const file = entries[0];
    if (entries.length !== 1 || !(file instanceof File)) {
      throw new DomainThrow(
        AppErrors.invalidField("file", "Exactly one file field named 'file' is required"),
      );
    }

    if (file.size > LIMITS.upload.maxBytes) {
      throw new DomainThrow(
        AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`),
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await createUpload(
      db,
      { storage, image, now },
      { uploaderId: caller.id, bytes },
    );

    return json(c, uploadSchema, unwrap(result), 201);
  });

  return app;
}

/**
 * The raw-bytes route, mounted separately from the rest of the API.
 *
 * It sits deliberately outside the session-resolving middleware: an
 * `<img src>` fetch is anonymous and immutable-cached, so paying for a
 * session lookup and a pet count on every photo request would be pure
 * waste. That also means it cannot read `c.var.ctx` — `db` is injected
 * directly instead.
 */
export function createUploadBytesRoute(db: Database, storage: StoragePort) {
  const app = new Hono();

  app.get("/uploads/:uploadId/raw", async (c) => {
    // A malformed id answers 404, not 400: this route is addressed by
    // browsers rather than API clients, and a broken `<img>` should
    // degrade to "missing" rather than to an error body the browser would
    // try to render as an image.
    const parsed = uploadIdParamsSchema.safeParse(c.req.param());
    if (!parsed.success) return c.notFound();

    const found = await getUploadBytes(db, storage, parsed.data.uploadId);
    if (!found) return c.notFound();

    c.header("Cache-Control", "public, max-age=31536000, immutable");
    c.header("Content-Type", found.mimeType);
    return c.body(found.bytes as unknown as ArrayBuffer);
  });

  return app;
}
