import { fileTypeFromBuffer } from "file-type";
import { ResultAsync } from "neverthrow";
import { v7 as uuidv7 } from "uuid";
import { LIMITS } from "#contracts";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import * as repo from "./uploads.repository.js";
import type { Upload } from "#contracts";
import type { UploadRow } from "./uploads.repository.js";
import type { Executor } from "../../db/types.js";
import type { IdPort } from "../../ports/id.port.js";
import type { ImagePort } from "../../ports/image.port.js";
import type { StoragePort } from "../../ports/storage.port.js";

const idPort: IdPort = { next: () => uuidv7() };
const MAX_EDGE_PX = 1600;

export function checkSize(byteSize: number): AppError | null {
  if (byteSize > LIMITS.upload.maxBytes) {
    return AppErrors.invalidField("file", `File exceeds the ${LIMITS.upload.maxBytes} byte limit`);
  }
  return null;
}

export async function sniffMime(bytes: Uint8Array): Promise<string | undefined> {
  const detected = await fileTypeFromBuffer(bytes);
  return detected?.mime;
}

export function isAllowedMime(mime: string | undefined): boolean {
  return mime !== undefined && (LIMITS.upload.mimeTypes as readonly string[]).includes(mime);
}

function storageKeyFor(id: string, now: Date): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `uploads/${yyyy}/${mm}/${id}.webp`;
}

function toUploadOutput(row: UploadRow): Upload {
  return {
    id: row.id,
    url: `/api/v1/uploads/${row.id}/raw`,
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

export function verifyOwned(
  db: Executor,
  uploadId: string,
  callerId: string,
): ResultAsync<UploadRow | undefined, AppError> {
  return ResultAsync.fromPromise(repo.findByIdOwned(db, uploadId, callerId), toAppError);
}
