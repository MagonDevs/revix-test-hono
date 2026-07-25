import { and, eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adoptionRequests } from "../../db/schema/adoption-requests.js";
import { favourites } from "../../db/schema/favourites.js";
import { petPhotos } from "../../db/schema/pet-photos.js";
import { pets } from "../../db/schema/pets.js";
import { uploads } from "../../db/schema/uploads.js";
import { startTestDb, withRollback, type TestDb } from "../../db/test/testcontainers-setup.js";
import { buildAdoptionRequest } from "../../seed/factories/request.factory.js";
import * as service from "./pets.service.js";
import type { Database, Transaction } from "../../db/types.js";

// Architecture §9 — every rule in contract §9 gets a test that cites its
// number. Docker required (Testcontainers Postgres).
//
// STATUS: not run in this sandbox — `docker ps` fails ("... no such
// file or directory"). Written to be correct and to run unmodified via
// `pnpm test:integration` once Docker is available.

let testDb: TestDb;

async function insertUser(
  tx: Transaction,
  input: { id: string; name: string; email: string; city: string },
) {
  const { user } = await import("../../db/schema/auth.js");
  await tx.insert(user).values({
    id: input.id,
    name: input.name,
    email: input.email,
    city: input.city,
  });
}

async function insertUpload(
  tx: Transaction,
  input: { id: string; uploaderId: string; consumedAt?: Date | null },
) {
  await tx.insert(uploads).values({
    id: input.id,
    uploaderId: input.uploaderId,
    storageKey: `uploads/2026/01/${input.id}.webp`,
    mimeType: "image/webp",
    byteSize: 12_345,
    width: 800,
    height: 600,
    consumedAt: input.consumedAt ?? null,
  });
}

describe("pets.service (requires Docker)", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("R-4: pets.create always creates status='available', regardless of the caller", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana@example.com", city: "Madrid" });
      const uploadId = uuidv7();
      await insertUpload(tx, { id: uploadId, uploaderId: ownerId });

      const result = await service.create(tx as unknown as Database, ownerId, {
        name: "Rex",
        species: "dog",
        breed: null,
        sex: "male",
        ageMonths: 12,
        size: "medium",
        weightKg: null,
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        photos: [{ uploadId, alt: null }],
        isVaccinated: true,
        isNeutered: false,
        isGoodWithKids: true,
        isGoodWithPets: false,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe("available");
        expect(result.value.photos).toHaveLength(1);
      }
    });
  });

  it("R-15: another user's uploadId is rejected on pets.create with a field error on photos[i].uploadId", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const strangerId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana2@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: strangerId,
        name: "Bea",
        email: "bea@example.com",
        city: "Madrid",
      });
      const strangersUploadId = uuidv7();
      await insertUpload(tx, { id: strangersUploadId, uploaderId: strangerId });

      const result = await service.create(tx as unknown as Database, ownerId, {
        name: "Rex",
        species: "dog",
        breed: null,
        sex: "male",
        ageMonths: 12,
        size: "medium",
        weightKg: null,
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        photos: [{ uploadId: strangersUploadId, alt: null }],
        isVaccinated: false,
        isNeutered: false,
        isGoodWithKids: false,
        isGoodWithPets: false,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("validation_error");
        if (result.error.code === "validation_error") {
          expect(result.error.fieldErrors[0]?.field).toBe("photos[0].uploadId");
        }
      }
    });
  });

  it("R-14: reusing an already-consumed upload is rejected", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana3@example.com", city: "Madrid" });
      const uploadId = uuidv7();
      await insertUpload(tx, { id: uploadId, uploaderId: ownerId, consumedAt: new Date() });

      const result = await service.create(tx as unknown as Database, ownerId, {
        name: "Rex",
        species: "dog",
        breed: null,
        sex: "male",
        ageMonths: 12,
        size: "medium",
        weightKg: null,
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        photos: [{ uploadId, alt: null }],
        isVaccinated: false,
        isNeutered: false,
        isGoodWithKids: false,
        isGoodWithPets: false,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error.code).toBe("validation_error");
      }
    });
  });

  it("R-2/R-16: pets.update by a non-owner returns not_found; sending photos replaces the whole set", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const strangerId = uuidv7();
      const petId = uuidv7();
      const photoUploadId = uuidv7();
      const newUploadId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana4@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: strangerId,
        name: "Bea",
        email: "bea2@example.com",
        city: "Madrid",
      });
      await insertUpload(tx, { id: photoUploadId, uploaderId: ownerId, consumedAt: new Date() });
      await insertUpload(tx, { id: newUploadId, uploaderId: ownerId });

      const now = new Date();
      await tx.insert(pets).values({
        id: petId,
        ownerId,
        name: "Rex",
        species: "dog",
        sex: "male",
        ageMonths: 12,
        size: "medium",
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        status: "available",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(petPhotos).values({
        id: uuidv7(),
        petId,
        uploadId: photoUploadId,
        position: 0,
        alt: null,
      });

      const strangerResult = await service.update(tx as unknown as Database, strangerId, {
        petId,
        name: "Hijacked",
      });
      expect(strangerResult.isErr()).toBe(true);
      if (strangerResult.isErr()) expect(strangerResult.error.code).toBe("not_found");

      const ownerResult = await service.update(tx as unknown as Database, ownerId, {
        petId,
        photos: [{ uploadId: newUploadId, alt: "New cover" }],
      });
      expect(ownerResult.isOk()).toBe(true);
      if (ownerResult.isOk()) {
        expect(ownerResult.value.photos).toHaveLength(1);
        expect(ownerResult.value.photos[0]?.alt).toBe("New cover");
      }

      const remainingPhotos = await tx.select().from(petPhotos).where(eq(petPhotos.petId, petId));
      expect(remainingPhotos).toHaveLength(1);
      expect(remainingPhotos[0]?.uploadId).toBe(newUploadId);
    });
  });

  it("R-5: every illegal pet status transition is rejected with conflictReason invalid_transition", async () => {
    const ILLEGAL: Array<[string, string]> = [
      ["available", "available"],
      ["adopted", "available"],
      ["adopted", "reserved"],
      ["withdrawn", "reserved"],
      ["withdrawn", "adopted"],
    ];

    for (const [from, to] of ILLEGAL) {
      await withRollback(testDb.db, async (tx) => {
        const ownerId = uuidv7();
        const petId = uuidv7();
        await insertUser(tx, {
          id: ownerId,
          name: "Ana",
          email: `ana-${petId}@example.com`,
          city: "Madrid",
        });
        const now = new Date();
        await tx.insert(pets).values({
          id: petId,
          ownerId,
          name: "Rex",
          species: "dog",
          sex: "male",
          ageMonths: 12,
          size: "medium",
          description: "A very good boy who loves long walks and belly rubs every single day.",
          city: "Madrid",
          status: from as "available" | "reserved" | "adopted" | "withdrawn",
          createdAt: now,
          updatedAt: now,
        });

        const result = await service.setStatus(tx as unknown as Database, ownerId, {
          petId,
          status: to as "available" | "reserved" | "adopted" | "withdrawn",
          declinePendingRequests: true,
        });

        expect(result.isErr()).toBe(true);
        if (result.isErr()) {
          expect(result.error.code).toBe("conflict");
          if (result.error.code === "conflict") {
            expect(result.error.reason).toBe("invalid_transition");
          }
        }
      });
    }
  });

  it("R-6: moving a pet to adopted declines exactly its pending requests, leaves accepted ones alone", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterAId = uuidv7();
      const adopterBId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "guardian@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterAId,
        name: "Bea",
        email: "adopterA@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterBId,
        name: "Cid",
        email: "adopterB@example.com",
        city: "Madrid",
      });

      const now = new Date();
      await tx.insert(pets).values({
        id: petId,
        ownerId: guardianId,
        name: "Rex",
        species: "dog",
        sex: "male",
        ageMonths: 12,
        size: "medium",
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        status: "reserved",
        createdAt: now,
        updatedAt: now,
      });

      const pendingRequestId = uuidv7();
      const acceptedRequestId = uuidv7();
      await tx.insert(adoptionRequests).values([
        buildAdoptionRequest({
          id: pendingRequestId,
          petId,
          adopterId: adopterAId,
          guardianId,
          status: "pending",
          createdAt: now,
        }),
        buildAdoptionRequest({
          id: acceptedRequestId,
          petId,
          adopterId: adopterBId,
          guardianId,
          status: "accepted",
          createdAt: now,
        }),
      ]);

      const result = await service.setStatus(tx as unknown as Database, guardianId, {
        petId,
        status: "adopted",
        declinePendingRequests: true,
      });
      expect(result.isOk()).toBe(true);

      const [pendingRow] = await tx
        .select()
        .from(adoptionRequests)
        .where(eq(adoptionRequests.id, pendingRequestId));
      const [acceptedRow] = await tx
        .select()
        .from(adoptionRequests)
        .where(eq(adoptionRequests.id, acceptedRequestId));

      expect(pendingRow?.status).toBe("declined");
      expect(acceptedRow?.status).toBe("accepted");
    });
  });

  it("R-17: deleting a pet cascades to its photos, requests and favourites", async () => {
    await withRollback(testDb.db, async (tx) => {
      const guardianId = uuidv7();
      const adopterId = uuidv7();
      const petId = uuidv7();
      const uploadId = uuidv7();
      await insertUser(tx, {
        id: guardianId,
        name: "Ana",
        email: "guardian2@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopterId,
        name: "Bea",
        email: "adopter2@example.com",
        city: "Madrid",
      });
      await insertUpload(tx, { id: uploadId, uploaderId: guardianId, consumedAt: new Date() });

      const now = new Date();
      await tx.insert(pets).values({
        id: petId,
        ownerId: guardianId,
        name: "Rex",
        species: "dog",
        sex: "male",
        ageMonths: 12,
        size: "medium",
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        status: "available",
        createdAt: now,
        updatedAt: now,
      });
      await tx.insert(petPhotos).values({
        id: uuidv7(),
        petId,
        uploadId,
        position: 0,
        alt: null,
      });
      await tx.insert(adoptionRequests).values(
        buildAdoptionRequest({
          id: uuidv7(),
          petId,
          adopterId,
          guardianId,
          status: "pending",
          createdAt: now,
        }),
      );
      await tx.insert(favourites).values({ userId: adopterId, petId, createdAt: now });

      const result = await service.remove(tx as unknown as Database, guardianId, petId);
      expect(result.isOk()).toBe(true);

      const remainingPhotos = await tx.select().from(petPhotos).where(eq(petPhotos.petId, petId));
      const remainingRequests = await tx
        .select()
        .from(adoptionRequests)
        .where(eq(adoptionRequests.petId, petId));
      const remainingFavourites = await tx
        .select()
        .from(favourites)
        .where(and(eq(favourites.petId, petId), eq(favourites.userId, adopterId)));

      expect(remainingPhotos).toHaveLength(0);
      expect(remainingRequests).toHaveLength(0);
      expect(remainingFavourites).toHaveLength(0);

      // The upload row itself survives (sweeper cleans it up later).
      const [uploadRow] = await tx.select().from(uploads).where(eq(uploads.id, uploadId));
      expect(uploadRow).toBeDefined();
    });
  });

  it("R-2: pets.remove by a non-owner returns not_found, not forbidden", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const strangerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana5@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: strangerId,
        name: "Bea",
        email: "bea3@example.com",
        city: "Madrid",
      });
      const now = new Date();
      await tx.insert(pets).values({
        id: petId,
        ownerId,
        name: "Rex",
        species: "dog",
        sex: "male",
        ageMonths: 12,
        size: "medium",
        description: "A very good boy who loves long walks and belly rubs every single day.",
        city: "Madrid",
        status: "available",
        createdAt: now,
        updatedAt: now,
      });

      const result = await service.remove(tx as unknown as Database, strangerId, petId);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("not_found");
    });
  });
});
