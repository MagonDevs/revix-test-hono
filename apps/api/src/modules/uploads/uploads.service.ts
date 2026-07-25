import { LIMITS } from "@adopta/contracts";
import { fileTypeFromBuffer } from "file-type";
import { ResultAsync } from "neverthrow";
import { Uuidv7IdAdapter } from "../../adapters/uuidv7.adapter.js";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../trpc/unwrap.js";
import * as repo from "./uploads.repository.js";
import type { UploadRow } from "./uploads.repository.js";
import type { Executor } from "../../db/types.js";
import type { ImagePort } from "../../ports/image.port.js";
import type { StoragePort } from "../../ports/storage.port.js";
import type { Upload } from "@adopta/contracts";

// Architecture §7 — the upload pipeline. HTTP-only (contract §7.4-7.5):
// `http/routes/uploads.route.ts` is the thin transport wrapper; the
// pipeline itself (size guard, sniffing, normalise, store, insert) lives
// here so it stays testable without an HTTP request.

const idPort = new Uuidv7IdAdapter();
const MAX_EDGE_PX = 1600;

/** Pure — testable without I/O. */
export function checkSize(byteSize: number): AppError | null {
  if (byteSize > LIMITS.upload.maxBytes) {
    return AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`);
  }
  return null;
}

/**
 * Sniffs the real type from the leading bytes via `file-type` — the
 * declared MIME type and filename are untrusted input (architecture §7
 * step 4).
 */
export async function sniffMime(bytes: Uint8Array): Promise<string | undefined> {
  const detected = await fileTypeFromBuffer(bytes);
  return detected?.mime;
}

export function isAllowedMime(mime: string | undefined): boolean {
  return mime !== undefined && (LIMITS.upload.mimeTypes as readonly string[]).includes(mime);
}

/** `uploads/<yyyy>/<mm>/<uuid>.webp` — no part of the key comes from user input. */
function storageKeyFor(id: string, now: Date): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${id}.webp`;
}

function toUploadOutput(row: UploadRow): Upload {
  return {
    id: row.id,
    url: `/api/uploads/${row.id}/raw`,
    width: row.width,
    height: row.height,
    byteSize: row.byteSize,
  };
}

export interface CreateUploadDeps {
  storage: StoragePort;
  image: ImagePort;
  now: () => Date;
}

/**
 * Full pipeline (architecture §7 steps 4-8): sniff -> sharp normalise ->
 * StoragePort.put -> insert. The size guard and rate limit (steps 2-3)
 * are the HTTP route's job — they need the request/session, not just
 * bytes.
 */
export function createUpload(
  db: Executor,
  deps: CreateUploadDeps,
  input: { uploaderId: string; bytes: Uint8Array },
): ResultAsync<Upload, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const sizeError = checkSize(input.bytes.byteLength);
      if (sizeError) throw new DomainThrow(sizeError);

      const mime = await sniffMime(input.bytes);
      if (!isAllowedMime(mime)) {
        throw new DomainThrow(AppErrors.invalidField("file", "Unsupported image type"));
      }

      const normalized = await deps.image.normalize(input.bytes, { maxEdgePx: MAX_EDGE_PX });
      const id = idPort.next();
      const now = deps.now();
      const storageKey = storageKeyFor(id, now);
      await deps.storage.put(storageKey, normalized.bytes);

      const row = await repo.insert(db, {
        id,
        uploaderId: input.uploaderId,
        storageKey,
        mimeType: "image/webp",
        byteSize: normalized.bytes.byteLength,
        width: normalized.width,
        height: normalized.height,
      });

      return toUploadOutput(row);
    })(),
    toAppError,
  );
}

export async function getUploadBytes(
  db: Executor,
  storage: StoragePort,
  uploadId: string,
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const row = await repo.findById(db, uploadId);
  if (!row) return null;
  const bytes = await storage.get(row.storageKey);
  if (!bytes) return null;
  return { bytes, mimeType: row.mimeType };
}

/**
 * Cross-module entry point for `modules/pets` (architecture §6.1 — calls
 * a function exported from the module's `index.ts`, passing the
 * transaction, never the repository directly). Returns the subset of
 * `uploadIds` that ARE owned by `callerId` and unconsumed; the caller
 * (pets.service) is responsible for turning any missing id into a
 * `photos[i].uploadId` field error (R-14, R-15).
 */
export function verifyOwnedUnconsumed(
  db: Executor,
  uploadIds: string[],
  callerId: string,
): ResultAsync<Map<string, UploadRow>, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await repo.findByIdsOwnedUnconsumed(db, uploadIds, callerId);
      return new Map(rows.map((row) => [row.id, row]));
    })(),
    toAppError,
  );
}

export function consumeUploads(db: Executor, uploadIds: string[], when: Date): Promise<void> {
  return repo.markConsumed(db, uploadIds, when);
}

/**
 * Cross-module entry point for `modules/users` (R-15, contract §8.2):
 * an avatar upload need only be owned by the caller — unlike pet
 * photos it isn't tracked by `consumedAt`, so re-setting the same
 * avatar (or one already used elsewhere) is not rejected.
 */
export function verifyOwned(
  db: Executor,
  uploadId: string,
  callerId: string,
): ResultAsync<UploadRow | undefined, AppError> {
  return ResultAsync.fromPromise(repo.findByIdOwned(db, uploadId, callerId), toAppError);
}
