import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { uploads } from "../../db/schema/uploads.js";
import type { Executor } from "../../db/types.js";

// Architecture §2.1 — Drizzle-only, own module types, no business rules
// beyond query shape. `pet_photos.upload_id` (unique + FK RESTRICT) is
// what makes R-14 true in the database; this repository's job is just
// CRUD on `uploads` itself.

export interface UploadRow {
  id: string;
  uploaderId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  consumedAt: Date | null;
  createdAt: Date;
}

export interface InsertUploadInput {
  id: string;
  uploaderId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
}

export async function insert(db: Executor, input: InsertUploadInput): Promise<UploadRow> {
  const [row] = await db.insert(uploads).values(input).returning();
  if (!row) throw new Error("Upload insert returned no row");
  return row;
}

export async function findById(db: Executor, id: string): Promise<UploadRow | undefined> {
  const [row] = await db.select().from(uploads).where(eq(uploads.id, id)).limit(1);
  return row;
}

/**
 * Rules R-14/R-15: only rows owned by `uploaderId` and not yet consumed
 * are eligible to be attached to a pet. Anything missing from the
 * result (id typo'd, owned by someone else, or already attached) is a
 * rejection — the caller maps that back onto a field error.
 */
export async function findByIdsOwnedUnconsumed(
  db: Executor,
  ids: string[],
  uploaderId: string,
): Promise<UploadRow[]> {
  if (ids.length === 0) return [];
  return db
    .select()
    .from(uploads)
    .where(
      and(inArray(uploads.id, ids), eq(uploads.uploaderId, uploaderId), isNull(uploads.consumedAt)),
    );
}

/**
 * Ownership-only lookup (no `consumedAt` check) — used for attachment
 * targets that aren't tracked by the pet-photo consumption mechanism,
 * e.g. a user avatar (contract §8.2, R-15). Re-setting the same avatar
 * (or an upload consumed elsewhere) is not an error here.
 */
export async function findByIdOwned(
  db: Executor,
  id: string,
  uploaderId: string,
): Promise<UploadRow | undefined> {
  const [row] = await db
    .select()
    .from(uploads)
    .where(and(eq(uploads.id, id), eq(uploads.uploaderId, uploaderId)))
    .limit(1);
  return row;
}

export async function markConsumed(db: Executor, ids: string[], when: Date): Promise<void> {
  if (ids.length === 0) return;
  await db.update(uploads).set({ consumedAt: when }).where(inArray(uploads.id, ids));
}

export async function deleteById(db: Executor, id: string): Promise<void> {
  await db.delete(uploads).where(eq(uploads.id, id));
}

/** `pnpm sweep:uploads` — unreferenced (never consumed) uploads older than the cutoff. */
export async function findUnconsumedOlderThan(db: Executor, cutoff: Date): Promise<UploadRow[]> {
  return db
    .select()
    .from(uploads)
    .where(and(isNull(uploads.consumedAt), lt(uploads.createdAt, cutoff)));
}
