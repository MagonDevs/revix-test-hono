import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user } from "../../db/schema/auth.js";
import { uploads } from "../../db/schema/uploads.js";
import { startTestDb, withRollback, type TestDb } from "../../db/test/testcontainers-setup.js";
import * as service from "./users.service.js";
import type { Transaction } from "../../db/types.js";

// Architecture §9 — rule R-15 gets a test citing it. Docker required
// (Testcontainers Postgres).
//
// STATUS: not run in this sandbox — Testcontainers can't pull/start the
// Postgres image within the 120s hook timeout here (network-restricted
// sandbox, same ceiling B7 hit). Written to be correct and to run
// unmodified via `pnpm test:integration` once Docker is available.

let testDb: TestDb;

async function insertUser(
  tx: Transaction,
  input: { id: string; name: string; email: string; city: string },
) {
  await tx
    .insert(user)
    .values({ id: input.id, name: input.name, email: input.email, city: input.city });
}

async function insertUpload(tx: Transaction, input: { id: string; uploaderId: string }) {
  await tx.insert(uploads).values({
    id: input.id,
    uploaderId: input.uploaderId,
    storageKey: `uploads/2026/01/${input.id}.webp`,
    mimeType: "image/webp",
    byteSize: 12_345,
    width: 800,
    height: 600,
  });
}

describe("users.service.updateMe — avatarUploadId (requires Docker)", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("R-15: rejects another user's upload with a validation_error field error", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = uuidv7();
      const stranger = uuidv7();
      const uploadId = uuidv7();
      await insertUser(tx, { id: owner, name: "Ana", email: "ana1@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: stranger,
        name: "Bea",
        email: "bea1@example.com",
        city: "Madrid",
      });
      await insertUpload(tx, { id: uploadId, uploaderId: owner });

      const result = await service.updateMe(tx, stranger, { avatarUploadId: uploadId });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("validation_error");
        if (result.error.code === "validation_error") {
          expect(result.error.fieldErrors[0]?.field).toBe("avatarUploadId");
        }
      }
    });
  });

  it("R-15: accepts an upload owned by the caller and resolves it to a public URL", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = uuidv7();
      const uploadId = uuidv7();
      await insertUser(tx, { id: owner, name: "Ana", email: "ana2@example.com", city: "Madrid" });
      await insertUpload(tx, { id: uploadId, uploaderId: owner });

      const result = await service.updateMe(tx, owner, { avatarUploadId: uploadId });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.avatarUrl).toBe(`/api/uploads/${uploadId}/raw`);
    });
  });

  it("setting the same avatar twice does not error (not consumption-tracked)", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = uuidv7();
      const uploadId = uuidv7();
      await insertUser(tx, { id: owner, name: "Ana", email: "ana3@example.com", city: "Madrid" });
      await insertUpload(tx, { id: uploadId, uploaderId: owner });

      const first = await service.updateMe(tx, owner, { avatarUploadId: uploadId });
      const second = await service.updateMe(tx, owner, { avatarUploadId: uploadId });

      expect(first.isOk()).toBe(true);
      expect(second.isOk()).toBe(true);
    });
  });

  it("explicit null clears the avatar", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = uuidv7();
      const uploadId = uuidv7();
      await insertUser(tx, { id: owner, name: "Ana", email: "ana4@example.com", city: "Madrid" });
      await insertUpload(tx, { id: uploadId, uploaderId: owner });
      await service.updateMe(tx, owner, { avatarUploadId: uploadId });

      const result = await service.updateMe(tx, owner, { avatarUploadId: null });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value.avatarUrl).toBeNull();
    });
  });
});
