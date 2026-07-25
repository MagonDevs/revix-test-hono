import {
  adoptionRequests as adoptionRequestsTable,
  petPhotos as petPhotosTable,
  pets as petsTable,
  uploads as uploadsTable,
} from "../../db/schema/index.js";
import { buildPet, type PetRow } from "../factories/pet.factory.js";
import { buildAdoptionRequest } from "../factories/request.factory.js";
import { createSeedUser } from "../factories/user.factory.js";
import { attachPhotos, type PetPhotoRow, type UploadRow } from "../images/attach.js";
import { IdSequence, faker, resetRng, seededDate } from "../rng.js";
import { at } from "../util.js";
import type { ScenarioSummary, SeedContext } from "../context.js";
import type { PetStatus, RequestStatus } from "@adopta/contracts";

// Spec §4 `edge` — every boundary from @adopta/contracts LIMITS: 2- and
// 40-char names, 30- and 2000-char descriptions, ages 0 and 360, 1-photo
// and 6-photo pets, a pet with every optional field null, one of every
// pet status, one of every request status, a user with a 500-char bio
// and no phone.

/** Pads/truncates `base` to exactly `length` characters. */
function exactLength(base: string, length: number): string {
  if (base.length >= length) return base.slice(0, length);
  return (base + " " + base.repeat(Math.ceil(length / base.length))).slice(0, length);
}

const PET_STATUSES: PetStatus[] = ["available", "reserved", "adopted", "withdrawn"];
const REQUEST_STATUSES: RequestStatus[] = ["pending", "accepted", "declined", "withdrawn"];

export async function seedEdge(ctx: SeedContext): Promise<ScenarioSummary> {
  resetRng();
  const ids = new IdSequence(0);

  const bio500 = exactLength(
    "This user has been fostering animals for many years and writes far too much in their profile bio, on purpose, to exercise the 500 character boundary the contract allows for a user's biography field so that clients rendering it never overflow their layout unexpectedly. ",
    500,
  );

  const users = [
    await createSeedUser(ctx.auth, ctx.db, {
      name: "Edge Owner",
      email: "edge-owner@example.com",
      password: "password123",
      city: "Madrid",
      phone: `+34 6${faker.string.numeric(8)}`,
    }),
    // "a user with a 500-char bio and no phone"
    await createSeedUser(ctx.auth, ctx.db, {
      name: "Edge Bio User",
      email: "edge-bio@example.com",
      password: "password123",
      city: "Barcelona",
      phone: null,
      bio: bio500,
    }),
    await createSeedUser(ctx.auth, ctx.db, {
      name: "Edge Adopter",
      email: "edge-adopter@example.com",
      password: "password123",
      city: "Valencia",
      phone: `+34 6${faker.string.numeric(8)}`,
    }),
  ];
  const owner = at(users, 0, "users");
  const adopter = at(users, 2, "users");

  const desc30 = exactLength("Small dog looking for a loving home today.", 30);
  const desc2000 = exactLength(
    "This description intentionally runs to the maximum allowed length so that any client rendering pet descriptions is honestly tested against the 2000 character contract boundary rather than only ever seeing short, comfortable sample text. ",
    2000,
  );

  const petRows: PetRow[] = [];
  const uploadRows: UploadRow[] = [];
  const photoRows: PetPhotoRow[] = [];

  const addPet = async (
    input: Parameters<typeof buildPet>[0] & { photoCount: number },
  ): Promise<void> => {
    const pet = buildPet(input);
    petRows.push(pet);
    const { uploads, photos } = await attachPhotos({
      petId: pet.id,
      ownerId: pet.ownerId,
      species: pet.species,
      name: pet.name,
      count: input.photoCount,
      createdAt: pet.createdAt,
      mode: ctx.imageMode,
      storage: ctx.storage,
      nextId: () => ids.next(),
    });
    uploadRows.push(...uploads);
    photoRows.push(...photos);
  };

  // 2-char name, 30-char description, age 0, 1 photo.
  await addPet({
    id: ids.next(),
    ownerId: owner.id,
    index: 0,
    species: "dog",
    name: "Bo",
    breed: "Mixed Breed",
    sex: "male",
    ageMonths: 0,
    size: "small",
    weightGrams: 500,
    description: desc30,
    city: "Madrid",
    status: "available",
    createdAt: seededDate(10),
    photoCount: 1,
  });

  // 40-char name, 2000-char description, age 360, 6 photos.
  await addPet({
    id: ids.next(),
    ownerId: owner.id,
    index: 1,
    species: "dog",
    name: exactLength("Very Old Long Named Dog Boundary Test XX", 40),
    breed: "Mastín Español",
    sex: "female",
    ageMonths: 360,
    size: "large",
    weightGrams: 60000,
    description: desc2000,
    city: "Barcelona",
    status: "available",
    createdAt: seededDate(9),
    photoCount: 6,
  });

  // Every optional field null: breed and weightGrams.
  await addPet({
    id: ids.next(),
    ownerId: owner.id,
    index: 2,
    species: "cat",
    breed: null,
    sex: "unknown",
    ageMonths: 24,
    size: "medium",
    weightGrams: null,
    city: "Valencia",
    status: "available",
    createdAt: seededDate(8),
    photoCount: 2,
  });

  // One of every remaining pet status.
  for (const [i, status] of PET_STATUSES.entries()) {
    await addPet({
      id: ids.next(),
      ownerId: owner.id,
      index: 3 + i,
      species: "rabbit",
      sex: "male",
      ageMonths: 12,
      size: "small",
      weightGrams: 2000,
      city: "Sevilla",
      status,
      createdAt: seededDate(7 - i),
      photoCount: 2,
    });
  }

  // One adoption request in every status. adoption_requests_active_uq
  // forbids two active (pending/accepted) requests for the same
  // (petId, adopterId) pair, so each status targets a different pet
  // (the four PET_STATUSES pets added above cover exactly four pets).
  const statusPets = [
    at(petRows, 0, "petRows"),
    at(petRows, 3, "petRows"),
    at(petRows, 4, "petRows"),
    at(petRows, 5, "petRows"),
  ];
  const requestRows = REQUEST_STATUSES.map((status, i) =>
    buildAdoptionRequest({
      id: ids.next(),
      petId: at(statusPets, i, "statusPets").id,
      adopterId: adopter.id,
      guardianId: owner.id,
      status,
      createdAt: seededDate(5 - i),
      index: i,
    }),
  );

  await ctx.db.insert(petsTable).values(petRows).onConflictDoNothing();
  if (uploadRows.length > 0)
    await ctx.db.insert(uploadsTable).values(uploadRows).onConflictDoNothing();
  if (photoRows.length > 0)
    await ctx.db.insert(petPhotosTable).values(photoRows).onConflictDoNothing();
  await ctx.db.insert(adoptionRequestsTable).values(requestRows).onConflictDoNothing();

  return {
    users: users.length,
    pets: petRows.length,
    photos: photoRows.length,
    requests: requestRows.length,
    favourites: 0,
  };
}
