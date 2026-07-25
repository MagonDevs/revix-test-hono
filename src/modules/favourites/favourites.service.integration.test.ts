import { eq } from "drizzle-orm";
import { v7 as uuidv7 } from "uuid";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { user } from "../../db/schema/auth.js";
import { favourites } from "../../db/schema/favourites.js";
import { pets } from "../../db/schema/pets.js";
import { startTestDb, withRollback, type TestDb } from "../../db/test/testcontainers-setup.js";
import * as service from "./favourites.service.js";
import type { Transaction } from "../../db/types.js";

let testDb: TestDb;

async function insertUser(
  tx: Transaction,
  input: { id: string; name: string; email: string; city: string },
) {
  await tx
    .insert(user)
    .values({ id: input.id, name: input.name, email: input.email, city: input.city });
}

async function insertPet(
  tx: Transaction,
  input: {
    id: string;
    ownerId: string;
    status?: "available" | "reserved" | "adopted" | "withdrawn";
  },
) {
  const now = new Date();
  await tx.insert(pets).values({
    id: input.id,
    ownerId: input.ownerId,
    name: "Rex",
    species: "dog",
    sex: "male",
    ageMonths: 12,
    size: "medium",
    description: "A very good boy who loves long walks and belly rubs every single day.",
    city: "Madrid",
    status: input.status ?? "available",
    createdAt: now,
    updatedAt: now,
  });
}

describe("favourites.service (requires Docker)", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb.teardown();
  });

  it("R-18: setting favourited=true twice is a no-op that succeeds both times", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana1@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea1@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId });

      const first = await service.set(tx, callerId, petId, true);
      const second = await service.set(tx, callerId, petId, true);

      expect(first.isOk()).toBe(true);
      expect(second.isOk()).toBe(true);
      if (first.isOk()) expect(first.value).toEqual({ petId, favourited: true });
      if (second.isOk()) expect(second.value).toEqual({ petId, favourited: true });

      const rows = await tx.select().from(favourites).where(eq(favourites.petId, petId));
      expect(rows).toHaveLength(1);
    });
  });

  it("R-18: setting favourited=false on a non-favourite succeeds", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana2@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea2@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId });

      const result = await service.set(tx, callerId, petId, false);

      expect(result.isOk()).toBe(true);
      if (result.isOk()) expect(result.value).toEqual({ petId, favourited: false });
    });
  });

  it("deleting a pet removes its favourites (FK ON DELETE CASCADE, db/schema/favourites.ts)", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana3@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea3@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId });

      const setResult = await service.set(tx, callerId, petId, true);
      expect(setResult.isOk()).toBe(true);

      await tx.delete(pets).where(eq(pets.id, petId));

      const rows = await tx.select().from(favourites).where(eq(favourites.petId, petId));
      expect(rows).toHaveLength(0);
    });
  });

  it("R-20-adjacent: one user's favourites never affect another's isFavourited", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const alice = uuidv7();
      const bob = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana4@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: alice,
        name: "Alice",
        email: "alice1@example.com",
        city: "Madrid",
      });
      await insertUser(tx, { id: bob, name: "Bob", email: "bob1@example.com", city: "Madrid" });
      await insertPet(tx, { id: petId, ownerId });

      const aliceSet = await service.set(tx, alice, petId, true);
      expect(aliceSet.isOk()).toBe(true);

      const aliceList = await service.list(tx, alice, 1, 20);
      const bobList = await service.list(tx, bob, 1, 20);

      expect(aliceList.isOk()).toBe(true);
      expect(bobList.isOk()).toBe(true);
      if (aliceList.isOk()) {
        expect(aliceList.value.items.map((p) => p.id)).toContain(petId);
        expect(aliceList.value.items.find((p) => p.id === petId)?.isFavourited).toBe(true);
      }
      if (bobList.isOk()) {
        expect(bobList.value.items.map((p) => p.id)).not.toContain(petId);
      }
    });
  });

  it("favourites.list includes pets in any status (e.g. adopted)", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana5@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea5@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId, status: "available" });

      const setResult = await service.set(tx, callerId, petId, true);
      expect(setResult.isOk()).toBe(true);

      await tx.update(pets).set({ status: "adopted" }).where(eq(pets.id, petId));

      const list = await service.list(tx, callerId, 1, 20);
      expect(list.isOk()).toBe(true);
      if (list.isOk()) {
        const found = list.value.items.find((p) => p.id === petId);
        expect(found?.status).toBe("adopted");
      }
    });
  });

  it("pagination: out-of-range page returns [] with correct total/totalPages, not an error", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana7@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea7@example.com",
        city: "Madrid",
      });

      for (let i = 0; i < 3; i += 1) {
        const petId = uuidv7();
        await insertPet(tx, { id: petId, ownerId });
        const setResult = await service.set(tx, callerId, petId, true);
        expect(setResult.isOk()).toBe(true);
      }

      const page = await service.list(tx, callerId, 5, 10);
      expect(page.isOk()).toBe(true);
      if (!page.isOk()) return;

      expect(page.value.items).toEqual([]);
      expect(page.value.meta.total).toBe(3);
      expect(page.value.meta.totalPages).toBe(1);
    });
  });

  it("favourites.set returns not_found for a pet invisible to the caller (withdrawn, not owner)", async () => {
    await withRollback(testDb.db, async (tx) => {
      const ownerId = uuidv7();
      const callerId = uuidv7();
      const petId = uuidv7();
      await insertUser(tx, { id: ownerId, name: "Ana", email: "ana6@example.com", city: "Madrid" });
      await insertUser(tx, {
        id: callerId,
        name: "Bea",
        email: "bea6@example.com",
        city: "Madrid",
      });
      await insertPet(tx, { id: petId, ownerId, status: "withdrawn" });

      const result = await service.set(tx, callerId, petId, true);
      expect(result.isErr()).toBe(true);
      if (result.isErr()) expect(result.error.code).toBe("not_found");
    });
  });
});
