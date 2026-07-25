import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adoptionRequests } from "../../db/schema/adoption-requests.js";
import { favourites } from "../../db/schema/favourites.js";
import { pets } from "../../db/schema/pets.js";
import { startTestDb, withRollback, type TestDb } from "../../db/test/testcontainers-setup.js";
import { buildFavourite } from "../../seed/factories/favourite.factory.js";
import { buildPet } from "../../seed/factories/pet.factory.js";
import { buildAdoptionRequest } from "../../seed/factories/request.factory.js";
import * as repo from "./pets.repository.js";
import type { PetSize, PetStatus, Sex, Species } from "#contracts";
import type { Transaction } from "../../db/types.js";

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

function pet(overrides: {
  id: string;
  ownerId: string;
  index: number;
  species?: Species;
  sex?: Sex;
  ageMonths?: number;
  size?: PetSize;
  city?: string;
  status?: PetStatus;
  createdAt: Date;
  name?: string;
}) {
  return buildPet({
    id: overrides.id,
    ownerId: overrides.ownerId,
    index: overrides.index,
    species: overrides.species ?? "dog",
    sex: overrides.sex ?? "unknown",
    ageMonths: overrides.ageMonths ?? 24,
    size: overrides.size ?? "medium",
    city: overrides.city ?? "Madrid",
    status: overrides.status ?? "available",
    createdAt: overrides.createdAt,
    ...(overrides.name !== undefined ? { name: overrides.name } : {}),
  });
}

describe("pets.repository (requires Docker)", () => {
  beforeAll(async () => {
    testDb = await startTestDb();
  }, 120_000);

  afterAll(async () => {
    await testDb?.teardown();
  });

  it("listPaginated excludes adopted and withdrawn, even for the owner", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-1";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner1@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      await tx.insert(pets).values([
        pet({
          id: "0198f7b0-0000-7000-8000-000000000001",
          ownerId: owner,
          index: 0,
          status: "available",
          createdAt: base,
        }),
        pet({
          id: "0198f7b0-0000-7000-8000-000000000002",
          ownerId: owner,
          index: 1,
          status: "reserved",
          createdAt: base,
        }),
        pet({
          id: "0198f7b0-0000-7000-8000-000000000003",
          ownerId: owner,
          index: 2,
          status: "adopted",
          createdAt: base,
        }),
        pet({
          id: "0198f7b0-0000-7000-8000-000000000004",
          ownerId: owner,
          index: 3,
          status: "withdrawn",
          createdAt: base,
        }),
      ]);

      const asOwner = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: owner,
      });
      expect(asOwner.total).toBe(2);
      expect(asOwner.items.map((p) => p.status).sort()).toEqual(["available", "reserved"]);

      const anon = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
      });
      expect(anon.total).toBe(2);
    });
  });

  it("filters by species, size, sex, ageGroup, city, q — alone and combined", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-2";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner2@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      await tx.insert(pets).values([
        pet({
          id: "0198f7b0-0001-7000-8000-000000000001",
          ownerId: owner,
          index: 0,
          species: "dog",
          size: "small",
          sex: "male",
          ageMonths: 2,
          city: "Madrid",
          createdAt: base,
          name: "Zephyr",
        }),
        pet({
          id: "0198f7b0-0001-7000-8000-000000000002",
          ownerId: owner,
          index: 1,
          species: "cat",
          size: "large",
          sex: "female",
          ageMonths: 100,
          city: "Barcelona",
          createdAt: base,
          name: "Whiskers",
        }),
      ]);

      const bySpecies = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        species: ["cat"],
      });
      expect(bySpecies.items.map((p) => p.id)).toEqual(["0198f7b0-0001-7000-8000-000000000002"]);

      const bySize = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        size: ["small"],
      });
      expect(bySize.items).toHaveLength(1);

      const bySex = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        sex: "female",
      });
      expect(bySex.items).toHaveLength(1);

      const byAgeGroup = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        ageGroup: "senior",
      });
      expect(byAgeGroup.items.map((p) => p.id)).toEqual(["0198f7b0-0001-7000-8000-000000000002"]);

      const byCity = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        city: "madr",
      });
      expect(byCity.items).toHaveLength(1);

      const byQ = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        q: "whiskers",
      });
      expect(byQ.items.map((p) => p.id)).toEqual(["0198f7b0-0001-7000-8000-000000000002"]);

      const combined = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        species: ["cat"],
        city: "barcelona",
      });
      expect(combined.items).toHaveLength(1);

      const combinedMiss = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
        species: ["cat"],
        city: "madrid",
      });
      expect(combinedMiss.items).toHaveLength(0);
    });
  });

  it("pagination: out-of-range page returns [] with correct meta, not an error", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-3";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner3@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      await tx.insert(pets).values(
        Array.from({ length: 3 }, (_, i) =>
          pet({
            id: `0198f7b0-0002-7000-8000-00000000000${i}`,
            ownerId: owner,
            index: i,
            createdAt: base,
          }),
        ),
      );

      const page = await repo.listPaginated(tx, {
        sort: "newest",
        page: 5,
        perPage: 12,
        viewerId: null,
      });
      expect(page.items).toEqual([]);
      expect(page.total).toBe(3);
    });
  });

  it("sorts newest/oldest/name_asc with id tie-breakers on identical timestamps", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-4";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner4@example.com",
        city: "Madrid",
      });
      const sameTime = new Date("2026-01-01T00:00:00Z");
      const rows = [
        pet({
          id: "0198f7b0-0003-7000-8000-000000000003",
          ownerId: owner,
          index: 0,
          createdAt: sameTime,
          name: "Bravo",
        }),
        pet({
          id: "0198f7b0-0003-7000-8000-000000000001",
          ownerId: owner,
          index: 1,
          createdAt: sameTime,
          name: "Alpha",
        }),
        pet({
          id: "0198f7b0-0003-7000-8000-000000000002",
          ownerId: owner,
          index: 2,
          createdAt: sameTime,
          name: "Alpha",
        }),
      ];
      await tx.insert(pets).values(rows);

      const newest = await repo.listPaginated(tx, {
        sort: "newest",
        page: 1,
        perPage: 12,
        viewerId: null,
      });
      expect(newest.items.map((p) => p.id)).toEqual([
        "0198f7b0-0003-7000-8000-000000000003",
        "0198f7b0-0003-7000-8000-000000000002",
        "0198f7b0-0003-7000-8000-000000000001",
      ]);

      const oldest = await repo.listPaginated(tx, {
        sort: "oldest",
        page: 1,
        perPage: 12,
        viewerId: null,
      });
      expect(oldest.items.map((p) => p.id)).toEqual([...newest.items.map((p) => p.id)].reverse());

      const nameAsc = await repo.listPaginated(tx, {
        sort: "name_asc",
        page: 1,
        perPage: 12,
        viewerId: null,
      });
      expect(nameAsc.items.map((p) => p.id)).toEqual([
        "0198f7b0-0003-7000-8000-000000000001",
        "0198f7b0-0003-7000-8000-000000000002",
        "0198f7b0-0003-7000-8000-000000000003",
      ]);
    });
  });

  it("findById: stranger cannot see withdrawn/adopted; owner can", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-5";
      const stranger = "stranger-5";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner5@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: stranger,
        name: "Stranger",
        email: "stranger5@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      await tx.insert(pets).values(
        pet({
          id: "0198f7b0-0004-7000-8000-000000000001",
          ownerId: owner,
          index: 0,
          status: "withdrawn",
          createdAt: base,
        }),
      );

      const asStranger = await repo.findById(tx, "0198f7b0-0004-7000-8000-000000000001", stranger);
      expect(asStranger).toBeUndefined();

      const asAnon = await repo.findById(tx, "0198f7b0-0004-7000-8000-000000000001", null);
      expect(asAnon).toBeUndefined();

      const asOwner = await repo.findById(tx, "0198f7b0-0004-7000-8000-000000000001", owner);
      expect(asOwner?.status).toBe("withdrawn");
    });
  });

  it("listByOwnerPaginated returns available pets only, regardless of caller", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-6";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner6@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      await tx.insert(pets).values([
        pet({
          id: "0198f7b0-0005-7000-8000-000000000001",
          ownerId: owner,
          index: 0,
          status: "available",
          createdAt: base,
        }),
        pet({
          id: "0198f7b0-0005-7000-8000-000000000002",
          ownerId: owner,
          index: 1,
          status: "reserved",
          createdAt: base,
        }),
        pet({
          id: "0198f7b0-0005-7000-8000-000000000003",
          ownerId: owner,
          index: 2,
          status: "adopted",
          createdAt: base,
        }),
      ]);

      const asOwner = await repo.listByOwnerPaginated(tx, owner, 1, 12, owner);
      expect(asOwner.items.map((p) => p.status)).toEqual(["available"]);

      const asAnon = await repo.listByOwnerPaginated(tx, owner, 1, 12, null);
      expect(asAnon.items.map((p) => p.status)).toEqual(["available"]);
    });
  });

  it("isFavourited and viewerRequestStatus are per-caller and never leak", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-7";
      const alice = "alice-7";
      const bob = "bob-7";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner7@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: alice,
        name: "Alice",
        email: "alice7@example.com",
        city: "Madrid",
      });
      await insertUser(tx, { id: bob, name: "Bob", email: "bob7@example.com", city: "Madrid" });
      const base = new Date("2026-01-01T00:00:00Z");
      const petId = "0198f7b0-0006-7000-8000-000000000001";
      await tx.insert(pets).values(pet({ id: petId, ownerId: owner, index: 0, createdAt: base }));

      await tx.insert(favourites).values(buildFavourite(alice, petId, base));
      await tx.insert(adoptionRequests).values(
        buildAdoptionRequest({
          id: "0198f7b0-0006-7000-8000-000000000099",
          petId,
          adopterId: alice,
          guardianId: owner,
          status: "pending",
          createdAt: base,
        }),
      );

      const asAlice = await repo.findById(tx, petId, alice);
      expect(asAlice?.isFavourited).toBe(true);
      expect(asAlice?.viewerRequestStatus).toBe("pending");

      const asBob = await repo.findById(tx, petId, bob);
      expect(asBob?.isFavourited).toBe(false);
      expect(asBob?.viewerRequestStatus).toBeNull();

      const asAnon = await repo.findById(tx, petId, null);
      expect(asAnon?.isFavourited).toBe(false);
      expect(asAnon?.viewerRequestStatus).toBeNull();
    });
  });

  it("findPhotosByPetIds returns photos ordered by position, keyed by pet_id, without joining before pagination", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-8";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner8@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      const petId = "0198f7b0-0007-7000-8000-000000000001";
      await tx.insert(pets).values(pet({ id: petId, ownerId: owner, index: 0, createdAt: base }));

      const { uploads } = await import("../../db/schema/uploads.js");
      const { petPhotos } = await import("../../db/schema/pet-photos.js");
      const uploadIds: [string, string] = [
        "0198f7b0-0007-7000-8000-000000000010",
        "0198f7b0-0007-7000-8000-000000000011",
      ];
      await tx.insert(uploads).values(
        uploadIds.map((id, i) => ({
          id,
          uploaderId: owner,
          storageKey: `key-${i}`,
          mimeType: "image/jpeg",
          byteSize: 1000,
          width: 800,
          height: 600,
        })),
      );
      await tx.insert(petPhotos).values([
        {
          id: "0198f7b0-0007-7000-8000-000000000021",
          petId,
          uploadId: uploadIds[1],
          position: 1,
          alt: null,
        },
        {
          id: "0198f7b0-0007-7000-8000-000000000020",
          petId,
          uploadId: uploadIds[0],
          position: 0,
          alt: "cover",
        },
      ]);

      const byPet = await repo.findPhotosByPetIds(tx, [petId]);
      const photos = byPet.get(petId) ?? [];
      expect(photos.map((p) => p.position)).toEqual([0, 1]);
      expect(photos[0]?.alt).toBe("cover");
    });
  });

  it("listMinePaginated returns all statuses, owned-only, with pendingRequestCount", async () => {
    await withRollback(testDb.db, async (tx) => {
      const owner = "owner-9";
      const adopter = "adopter-9";
      await insertUser(tx, {
        id: owner,
        name: "Owner",
        email: "owner9@example.com",
        city: "Madrid",
      });
      await insertUser(tx, {
        id: adopter,
        name: "Adopter",
        email: "adopter9@example.com",
        city: "Madrid",
      });
      const base = new Date("2026-01-01T00:00:00Z");
      const petId = "0198f7b0-0008-7000-8000-000000000001";
      await tx.insert(pets).values([
        pet({ id: petId, ownerId: owner, index: 0, status: "withdrawn", createdAt: base }),
        pet({
          id: "0198f7b0-0008-7000-8000-000000000002",
          ownerId: owner,
          index: 1,
          status: "available",
          createdAt: base,
        }),
      ]);
      await tx.insert(adoptionRequests).values([
        buildAdoptionRequest({
          id: "0198f7b0-0008-7000-8000-000000000091",
          petId,
          adopterId: adopter,
          guardianId: owner,
          status: "pending",
          createdAt: base,
        }),
      ]);

      const mine = await repo.listMinePaginated(tx, owner, {
        sort: "newest",
        page: 1,
        perPage: 12,
      });
      expect(mine.total).toBe(2);
      expect(mine.items.map((p) => p.status).sort()).toEqual(["available", "withdrawn"]);
      const withdrawn = mine.items.find((p) => p.id === petId);
      expect(withdrawn?.pendingRequestCount).toBe(1);
    });
  });
});
