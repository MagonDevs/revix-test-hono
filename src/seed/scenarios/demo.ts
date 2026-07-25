import {
  adoptionRequests as adoptionRequestsTable,
  favourites as favouritesTable,
  petPhotos as petPhotosTable,
  pets as petsTable,
  uploads as uploadsTable,
} from "../../db/schema/index.js";
import { CITIES } from "../data/cities.js";
import { buildFavourite, type FavouriteRow } from "../factories/favourite.factory.js";
import { buildPet, photoCountFor, type PetRow } from "../factories/pet.factory.js";
import { buildAdoptionRequest, type AdoptionRequestRow } from "../factories/request.factory.js";
import { createSeedUser, type SeededUser } from "../factories/user.factory.js";
import { attachPhotos, type PetPhotoRow, type UploadRow } from "../images/attach.js";
import { IdSequence, faker, resetRng, seededDate } from "../rng.js";
import { at } from "../util.js";
import type { Species, PetStatus, RequestStatus, Sex, PetSize } from "#contracts";
import type { ScenarioSummary, SeedContext } from "../context.js";

// Spec §4 `demo` — 8 users; 40 pets (28 available, 5 reserved, 5
// adopted, 2 withdrawn) across 6 cities, createdAt spread over 90 days;
// 14 adoption requests across every status incl. >=1 accepted pair; 6
// favourites for marta@example.com/password123.

const DEMO_USERS = [
  { name: "Marta Ruiz", email: "marta@example.com", city: "Madrid" },
  { name: "Diego Fernandez", email: "diego@example.com", city: "Barcelona" },
  { name: "Laia Puig", email: "laia@example.com", city: "Valencia" },
  { name: "Carlos Nunez", email: "carlos@example.com", city: "Sevilla" },
  { name: "Elena Vidal", email: "elena@example.com", city: "Bilbao" },
  { name: "Marc Soler", email: "marc@example.com", city: "Zaragoza" },
  { name: "Paula Ortiz", email: "paula@example.com", city: "Madrid" },
  { name: "Jorge Blanco", email: "jorge@example.com", city: "Barcelona" },
];

const DEMO_PASSWORD = "password123";

const SPECIES_CYCLE: Species[] = ["dog", "cat", "rabbit", "bird", "other"];
const SEX_CYCLE: Sex[] = ["male", "female", "unknown"];
const SIZE_CYCLE: PetSize[] = ["small", "medium", "large"];

function statusForIndex(index: number): PetStatus {
  // 28 available (0-27), 5 reserved (28-32), 5 adopted (33-37), 2 withdrawn (38-39)
  if (index < 28) return "available";
  if (index < 33) return "reserved";
  if (index < 38) return "adopted";
  return "withdrawn";
}

export async function seedDemo(ctx: SeedContext): Promise<ScenarioSummary> {
  resetRng();
  const ids = new IdSequence(0);

  const users: SeededUser[] = [];
  for (const u of DEMO_USERS) {
    const created = await createSeedUser(ctx.auth, ctx.db, {
      name: u.name,
      email: u.email,
      password: DEMO_PASSWORD,
      city: u.city,
      phone: `+34 6${faker.string.numeric(8)}`,
      bio: `${u.name.split(" ")[0]} loves fostering animals in ${u.city}.`,
    });
    users.push(created);
  }
  const marta = at(users, 0, "users");

  const petRows: PetRow[] = [];
  const uploadRows: UploadRow[] = [];
  const photoRows: PetPhotoRow[] = [];

  for (let i = 0; i < 40; i++) {
    const species = at(SPECIES_CYCLE, i % SPECIES_CYCLE.length, "SPECIES_CYCLE");
    const owner = at(users, i % users.length, "users");
    const city = at(CITIES, i % CITIES.length, "CITIES").name;
    const status = statusForIndex(i);
    const createdAt = seededDate(90 - Math.floor((i * 90) / 40));
    const petId = ids.next();

    const pet = buildPet({
      id: petId,
      ownerId: owner.id,
      index: i,
      species,
      sex: at(SEX_CYCLE, i % SEX_CYCLE.length, "SEX_CYCLE"),
      ageMonths: 3 + ((i * 7) % 150),
      size: at(SIZE_CYCLE, i % SIZE_CYCLE.length, "SIZE_CYCLE"),
      // Contract §4: weightKg is validated to one decimal place, i.e.
      // weight_grams must be a whole multiple of 100. Quantise to the
      // nearest 100g while preserving the deterministic spread.
      weightGrams: Math.round((1500 + ((i * 733) % 40000)) / 100) * 100,
      city,
      status,
      createdAt,
      isVaccinated: i % 3 !== 0,
      isNeutered: i % 4 !== 0,
      isGoodWithKids: i % 2 === 0,
      isGoodWithPets: i % 3 === 0,
    });
    petRows.push(pet);

    const count = photoCountFor(((i * 37) % 100) / 100);
    const { uploads, photos } = await attachPhotos({
      petId,
      ownerId: owner.id,
      species,
      name: pet.name,
      count,
      createdAt,
      mode: ctx.imageMode,
      storage: ctx.storage,
      nextId: () => ids.next(),
    });
    uploadRows.push(...uploads);
    photoRows.push(...photos);
  }

  // 14 adoption requests across every status, >=1 accepted pair.
  const REQUEST_STATUSES: RequestStatus[] = [
    "pending",
    "pending",
    "pending",
    "pending",
    "pending",
    "accepted",
    "accepted",
    "accepted",
    "accepted",
    "declined",
    "declined",
    "declined",
    "withdrawn",
    "withdrawn",
  ];
  const requestRows: AdoptionRequestRow[] = [];
  for (let i = 0; i < REQUEST_STATUSES.length; i++) {
    const pet = at(petRows, i % petRows.length, "petRows");
    // Pick an adopter distinct from the pet's owner.
    const adopter =
      users.find((u) => u.id !== pet.ownerId) ?? at(users, (i + 1) % users.length, "users");
    const createdAt = seededDate(60 - i * 2);
    requestRows.push(
      buildAdoptionRequest({
        id: ids.next(),
        petId: pet.id,
        adopterId: adopter.id,
        guardianId: pet.ownerId,
        status: at(REQUEST_STATUSES, i, "REQUEST_STATUSES"),
        createdAt,
        index: i,
      }),
    );
  }

  // 6 favourites for the demo user, on pets Marta doesn't own.
  const favouriteRows: FavouriteRow[] = [];
  const candidates = petRows.filter((p) => p.ownerId !== marta.id);
  for (let i = 0; i < 6; i++) {
    const pet = at(candidates, i % candidates.length, "candidates");
    favouriteRows.push(buildFavourite(marta.id, pet.id, seededDate(30 - i)));
  }

  await ctx.db.insert(petsTable).values(petRows).onConflictDoNothing();
  if (uploadRows.length > 0)
    await ctx.db.insert(uploadsTable).values(uploadRows).onConflictDoNothing();
  if (photoRows.length > 0)
    await ctx.db.insert(petPhotosTable).values(photoRows).onConflictDoNothing();
  await ctx.db.insert(adoptionRequestsTable).values(requestRows).onConflictDoNothing();
  await ctx.db.insert(favouritesTable).values(favouriteRows).onConflictDoNothing();

  return {
    users: users.length,
    pets: petRows.length,
    photos: photoRows.length,
    requests: requestRows.length,
    favourites: favouriteRows.length,
  };
}

export { DEMO_USERS, DEMO_PASSWORD };
