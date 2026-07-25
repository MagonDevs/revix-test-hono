import {
  adoptionRequests as adoptionRequestsTable,
  petPhotos as petPhotosTable,
  pets as petsTable,
  uploads as uploadsTable,
} from "../../db/schema/index.js";
import { CITIES } from "../data/cities.js";
import { buildPet, photoCountFor, type PetRow } from "../factories/pet.factory.js";
import { buildAdoptionRequest, type AdoptionRequestRow } from "../factories/request.factory.js";
import { createSeedUser, type SeededUser } from "../factories/user.factory.js";
import { attachPhotos, type PetPhotoRow, type UploadRow } from "../images/attach.js";
import { IdSequence, faker, resetRng, seededDate } from "../rng.js";
import { at } from "../util.js";
import type { ScenarioSummary, SeedContext } from "../context.js";
import type { PetSize, PetStatus, RequestStatus, Sex, Species } from "@adopta/contracts";

// Spec §4 `large` — 5,000 pets, 200 users, 20,000 requests, images
// always in `offline` mode (index verification, EXPLAIN plans, proving
// deep pagination is still fast — none of that needs real bytes, and
// offline is the only mode with zero network cost at this volume).

const SPECIES_CYCLE: Species[] = ["dog", "cat", "rabbit", "bird", "other"];
const SEX_CYCLE: Sex[] = ["male", "female", "unknown"];
const SIZE_CYCLE: PetSize[] = ["small", "medium", "large"];
const PET_STATUS_CYCLE: PetStatus[] = [
  "available",
  "available",
  "available",
  "reserved",
  "adopted",
  "withdrawn",
];
const REQUEST_STATUS_CYCLE: RequestStatus[] = ["pending", "accepted", "declined", "withdrawn"];

const USER_COUNT = 200;
const PET_COUNT = 5000;
const REQUEST_COUNT = 20000;
const BATCH_SIZE = 500;

export async function seedLarge(ctx: SeedContext): Promise<ScenarioSummary> {
  resetRng();
  const ids = new IdSequence(0);
  const largeCtx: SeedContext = { ...ctx, imageMode: "offline" };

  const users: SeededUser[] = [];
  for (let i = 0; i < USER_COUNT; i++) {
    const city = at(CITIES, i % CITIES.length, "CITIES").name;
    const created = await createSeedUser(largeCtx.auth, largeCtx.db, {
      name: `Seed User ${i + 1}`,
      email: `seed-user-${i + 1}@example.com`,
      password: "password123",
      city,
      phone: `+34 6${faker.string.numeric(8)}`,
      avatar: true,
    });
    users.push(created);
  }

  const petRows: PetRow[] = [];
  const uploadRows: UploadRow[] = [];
  const photoRows: PetPhotoRow[] = [];

  for (let i = 0; i < PET_COUNT; i++) {
    const species = at(SPECIES_CYCLE, i % SPECIES_CYCLE.length, "SPECIES_CYCLE");
    const owner = at(users, i % users.length, "users");
    const city = at(CITIES, i % CITIES.length, "CITIES").name;
    const status = at(PET_STATUS_CYCLE, i % PET_STATUS_CYCLE.length, "PET_STATUS_CYCLE");
    const createdAt = seededDate(365 - (i % 365));
    const petId = ids.next();

    const pet = buildPet({
      id: petId,
      ownerId: owner.id,
      index: i,
      species,
      sex: at(SEX_CYCLE, i % SEX_CYCLE.length, "SEX_CYCLE"),
      ageMonths: i % 200,
      size: at(SIZE_CYCLE, i % SIZE_CYCLE.length, "SIZE_CYCLE"),
      weightGrams: 1000 + ((i * 517) % 50000),
      city,
      status,
      createdAt,
    });
    petRows.push(pet);

    const count = photoCountFor(((i * 53) % 100) / 100);
    const { uploads, photos } = await attachPhotos({
      petId,
      ownerId: owner.id,
      species,
      name: pet.name,
      count,
      createdAt,
      mode: "offline",
      storage: largeCtx.storage,
      nextId: () => ids.next(),
    });
    uploadRows.push(...uploads);
    photoRows.push(...photos);
  }

  // adoption_requests_active_uq forbids more than one pending/accepted
  // request for the same (petId, adopterId) pair — track pairs already
  // "active" and fall back to a resolved status (declined/withdrawn,
  // exempt from the constraint) for later collisions on the same pair.
  const activePairs = new Set<string>();
  const requestRows: AdoptionRequestRow[] = [];
  for (let i = 0; i < REQUEST_COUNT; i++) {
    const pet = at(petRows, i % petRows.length, "petRows");
    const adopter = at(users, (i + 1) % users.length, "users");
    if (adopter.id === pet.ownerId) continue; // keep the no-self-request invariant

    let status = at(REQUEST_STATUS_CYCLE, i % REQUEST_STATUS_CYCLE.length, "REQUEST_STATUS_CYCLE");
    const pairKey = `${pet.id}:${adopter.id}`;
    if (status === "pending" || status === "accepted") {
      if (activePairs.has(pairKey)) {
        status = i % 2 === 0 ? "declined" : "withdrawn";
      } else {
        activePairs.add(pairKey);
      }
    }

    requestRows.push(
      buildAdoptionRequest({
        id: ids.next(),
        petId: pet.id,
        adopterId: adopter.id,
        guardianId: pet.ownerId,
        status,
        createdAt: seededDate(300 - (i % 300)),
        index: i,
      }),
    );
  }

  for (let i = 0; i < petRows.length; i += BATCH_SIZE) {
    await largeCtx.db
      .insert(petsTable)
      .values(petRows.slice(i, i + BATCH_SIZE))
      .onConflictDoNothing();
  }
  for (let i = 0; i < uploadRows.length; i += BATCH_SIZE) {
    await largeCtx.db
      .insert(uploadsTable)
      .values(uploadRows.slice(i, i + BATCH_SIZE))
      .onConflictDoNothing();
  }
  for (let i = 0; i < photoRows.length; i += BATCH_SIZE) {
    await largeCtx.db
      .insert(petPhotosTable)
      .values(photoRows.slice(i, i + BATCH_SIZE))
      .onConflictDoNothing();
  }
  for (let i = 0; i < requestRows.length; i += BATCH_SIZE) {
    await largeCtx.db
      .insert(adoptionRequestsTable)
      .values(requestRows.slice(i, i + BATCH_SIZE))
      .onConflictDoNothing();
  }

  return {
    users: users.length,
    pets: petRows.length,
    photos: photoRows.length,
    requests: requestRows.length,
    favourites: 0,
  };
}
