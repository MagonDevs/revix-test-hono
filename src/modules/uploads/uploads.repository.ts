import { and, eq, inArray, isNull, lt } from "drizzle-orm";
import { uploads } from "../../db/schema/uploads.js";
import type { Executor } from "../../db/types.js";

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

export async function findUnconsumedOlderThan(db: Executor, cutoff: Date): Promise<UploadRow[]> {
  return db
    .select()
    .from(uploads)
    .where(and(isNull(uploads.consumedAt), lt(uploads.createdAt, cutoff)));
}
