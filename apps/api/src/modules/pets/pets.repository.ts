import { and, asc, between, desc, eq, inArray, or, type SQL, sql } from "drizzle-orm";
import { user } from "../../db/schema/auth.js";
import { petPhotos } from "../../db/schema/pet-photos.js";
import { pets } from "../../db/schema/pets.js";
import { uploads } from "../../db/schema/uploads.js";
import { ageGroupRange, PUBLIC_LIST_STATUSES } from "./pets.domain.js";
import type { PetPhotoRow, PetRow, ViewerFlags } from "./pets.mapper.js";
import type { Executor } from "../../db/types.js";
import type { AgeGroup, PetSize, PetSort, PetStatus, Species, Sex } from "@adopta/contracts";

// Drizzle-only, own module types, no business rules beyond query shape
// (architecture §2.1). Business rules (age group ranges, the public
// status set) live in pets.domain.ts and are imported, not re-derived.

/**
 * Architecture §4.1 — visibility is a query concern. A stranger sees
 * only `available`/`reserved`; the owner sees their own pet in any
 * status. Used by `findById` (rule R-2). Public *lists* (`pets.list`,
 * `pets.listByOwner`) use a fixed public-status predicate instead —
 * R-1/R-3 hide `adopted`/`withdrawn` even from the owner there.
 */
function visibilityPredicate(viewerId: string | null): SQL {
  return viewerId
    ? (or(inArray(pets.status, PUBLIC_LIST_STATUSES), eq(pets.ownerId, viewerId)) as SQL)
    : inArray(pets.status, PUBLIC_LIST_STATUSES);
}

/** R-20 — computed per caller. Anonymous callers get literal `false`/`null`, never a join on a null id. */
function viewerFlagFields(viewerId: string | null) {
  return {
    isFavourited: viewerId
      ? sql<boolean>`exists (
          select 1 from favourites f
          where f.pet_id = ${pets.id} and f.user_id = ${viewerId}
        )`
      : sql<boolean>`false`,
    viewerRequestStatus: viewerId
      ? sql<string | null>`(
          select ar.status from adoption_requests ar
          where ar.pet_id = ${pets.id} and ar.adopter_id = ${viewerId}
          order by ar.created_at desc limit 1
        )`
      : sql<string | null>`null`,
  };
}

const guardianFields = {
  id: user.id,
  name: user.name,
  email: user.email,
  image: user.image,
  city: user.city,
  phone: user.phone,
  bio: user.bio,
  createdAt: user.createdAt,
};

const petFields = {
  id: pets.id,
  name: pets.name,
  species: pets.species,
  breed: pets.breed,
  sex: pets.sex,
  ageMonths: pets.ageMonths,
  size: pets.size,
  weightGrams: pets.weightGrams,
  description: pets.description,
  city: pets.city,
  status: pets.status,
  isVaccinated: pets.isVaccinated,
  isNeutered: pets.isNeutered,
  isGoodWithKids: pets.isGoodWithKids,
  isGoodWithPets: pets.isGoodWithPets,
  createdAt: pets.createdAt,
  updatedAt: pets.updatedAt,
};

function orderByFor(sort: PetSort) {
  switch (sort) {
    case "newest":
      return [desc(pets.createdAt), desc(pets.id)];
    case "oldest":
      return [asc(pets.createdAt), asc(pets.id)];
    case "name_asc":
      return [asc(sql`lower(${pets.name})`), asc(pets.id)];
  }
}

export interface PetsListFilters {
  q?: string | undefined;
  species?: Species[] | undefined;
  size?: PetSize[] | undefined;
  sex?: Sex | undefined;
  ageGroup?: AgeGroup | undefined;
  city?: string | undefined;
  sort: PetSort;
  page: number;
  perPage: number;
  viewerId: string | null;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

type PetRowWithFlags = PetRow & ViewerFlags;

function toPetRow(row: {
  id: string;
  name: string;
  species: PetRow["species"];
  breed: string | null;
  sex: PetRow["sex"];
  ageMonths: number;
  size: PetRow["size"];
  weightGrams: number | null;
  description: string;
  city: string;
  status: PetRow["status"];
  isVaccinated: boolean;
  isNeutered: boolean;
  isGoodWithKids: boolean;
  isGoodWithPets: boolean;
  createdAt: Date;
  updatedAt: Date;
  guardian: PetRow["guardian"];
  isFavourited: boolean;
  viewerRequestStatus: string | null;
}): PetRowWithFlags {
  const { isFavourited, viewerRequestStatus, ...pet } = row;
  return {
    ...pet,
    guardian: pet.guardian,
    isFavourited,
    viewerRequestStatus: viewerRequestStatus as ViewerFlags["viewerRequestStatus"],
  };
}

function buildListFilters(filters: PetsListFilters): SQL[] {
  const conditions: SQL[] = [inArray(pets.status, PUBLIC_LIST_STATUSES)];

  if (filters.q) {
    conditions.push(sql`${pets.searchVector} @@ plainto_tsquery('simple', ${filters.q})`);
  }
  if (filters.species && filters.species.length > 0) {
    conditions.push(inArray(pets.species, filters.species));
  }
  if (filters.size && filters.size.length > 0) {
    conditions.push(inArray(pets.size, filters.size));
  }
  if (filters.sex) {
    conditions.push(eq(pets.sex, filters.sex));
  }
  if (filters.city) {
    conditions.push(sql`lower(${pets.city}) like ${`%${filters.city.toLowerCase()}%`}`);
  }
  if (filters.ageGroup) {
    const [lo, hi] = ageGroupRange(filters.ageGroup);
    conditions.push(between(pets.ageMonths, lo, hi));
  }
  return conditions;
}

/**
 * Contract §8.3 `pets.list`. Two-query pattern (data model §5): this
 * fetches the page of pets (with `count(*) over()` for `total` and the
 * viewer-flag subqueries) — callers fetch photos separately via
 * `findPhotosByPetIds`, keyed by the returned ids.
 */
export async function listPaginated(
  db: Executor,
  filters: PetsListFilters,
): Promise<PageResult<PetRowWithFlags>> {
  const where = and(...buildListFilters(filters)) as SQL;
  const flags = viewerFlagFields(filters.viewerId);

  const rows = await db
    .select({
      ...petFields,
      guardian: guardianFields,
      ...flags,
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(pets)
    .innerJoin(user, eq(pets.ownerId, user.id))
    .where(where)
    .orderBy(...orderByFor(filters.sort))
    .limit(filters.perPage)
    .offset((filters.page - 1) * filters.perPage);

  const total = rows[0]?.total ?? 0;
  return { items: rows.map((r) => toPetRow(r)), total };
}

/** Contract §8.3 `pets.byId` — same visibility rule as R-2, single row. */
export async function findById(
  db: Executor,
  petId: string,
  viewerId: string | null,
): Promise<PetRowWithFlags | undefined> {
  const flags = viewerFlagFields(viewerId);
  const [row] = await db
    .select({ ...petFields, guardian: guardianFields, ...flags })
    .from(pets)
    .innerJoin(user, eq(pets.ownerId, user.id))
    .where(and(eq(pets.id, petId), visibilityPredicate(viewerId)))
    .limit(1);
  return row ? toPetRow(row) : undefined;
}

/** Contract §8.3 `pets.listByOwner` — `available` only, regardless of caller (R-3). */
export async function listByOwnerPaginated(
  db: Executor,
  ownerId: string,
  page: number,
  perPage: number,
  viewerId: string | null,
): Promise<PageResult<PetRowWithFlags>> {
  const flags = viewerFlagFields(viewerId);
  const where = and(eq(pets.ownerId, ownerId), eq(pets.status, "available" as PetStatus)) as SQL;

  const rows = await db
    .select({
      ...petFields,
      guardian: guardianFields,
      ...flags,
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(pets)
    .innerJoin(user, eq(pets.ownerId, user.id))
    .where(where)
    .orderBy(desc(pets.createdAt), desc(pets.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const total = rows[0]?.total ?? 0;
  return { items: rows.map((r) => toPetRow(r)), total };
}

export interface PetsListMineFilters {
  status?: PetStatus | undefined;
  sort: PetSort;
  page: number;
  perPage: number;
}

type OwnedPetRowWithFlags = PetRowWithFlags & { pendingRequestCount: number };

/** Contract §8.3 `pets.listMine` — all statuses, owned-only, plus pendingRequestCount. */
export async function listMinePaginated(
  db: Executor,
  ownerId: string,
  filters: PetsListMineFilters,
): Promise<PageResult<OwnedPetRowWithFlags>> {
  const conditions: SQL[] = [eq(pets.ownerId, ownerId)];
  if (filters.status) conditions.push(eq(pets.status, filters.status));
  const flags = viewerFlagFields(ownerId);

  const rows = await db
    .select({
      ...petFields,
      guardian: guardianFields,
      ...flags,
      pendingRequestCount: sql<number>`(
        select count(*) from adoption_requests ar
        where ar.pet_id = ${pets.id} and ar.status = 'pending'
      )`.mapWith(Number),
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(pets)
    .innerJoin(user, eq(pets.ownerId, user.id))
    .where(and(...conditions))
    .orderBy(...orderByFor(filters.sort))
    .limit(filters.perPage)
    .offset((filters.page - 1) * filters.perPage);

  const total = rows[0]?.total ?? 0;
  return {
    items: rows.map((r) => ({ ...toPetRow(r), pendingRequestCount: r.pendingRequestCount })),
    total,
  };
}

/**
 * Photos for a page of pets, keyed by `pet_id`, ordered by `position`
 * (index 0 = cover). Fetched in a second query, never joined before
 * pagination (data model §5.1).
 */
export async function findPhotosByPetIds(
  db: Executor,
  petIds: string[],
): Promise<Map<string, PetPhotoRow[]>> {
  const byPet = new Map<string, PetPhotoRow[]>();
  if (petIds.length === 0) return byPet;

  const rows = await db
    .select({
      id: petPhotos.id,
      petId: petPhotos.petId,
      alt: petPhotos.alt,
      position: petPhotos.position,
      uploadId: petPhotos.uploadId,
      width: uploads.width,
      height: uploads.height,
    })
    .from(petPhotos)
    .innerJoin(uploads, eq(petPhotos.uploadId, uploads.id))
    .where(inArray(petPhotos.petId, petIds))
    .orderBy(asc(petPhotos.petId), asc(petPhotos.position));

  for (const row of rows) {
    const list = byPet.get(row.petId) ?? [];
    list.push({
      id: row.id,
      alt: row.alt,
      position: row.position,
      uploadId: row.uploadId,
      width: row.width,
      height: row.height,
    });
    byPet.set(row.petId, list);
  }
  return byPet;
}

// --- Write side (B6): pets.create/update/setStatus/remove -----------------
// R-2 applies here too: writes are scoped by `ownerId` in the WHERE, not
// a post-fetch check, so "not the owner" and "doesn't exist" both come
// back as `undefined` -> the service maps that to `not_found`.

export interface InsertPetInput {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: Sex;
  ageMonths: number;
  size: PetSize;
  weightGrams: number | null;
  description: string;
  city: string;
  isVaccinated: boolean;
  isNeutered: boolean;
  isGoodWithKids: boolean;
  isGoodWithPets: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** R-4 — status is never accepted here; the column default is `available`. */
export async function insert(db: Executor, input: InsertPetInput): Promise<void> {
  await db.insert(pets).values(input);
}

export interface InsertPhotoInput {
  id: string;
  petId: string;
  uploadId: string;
  position: number;
  alt: string | null;
}

export async function insertPhotos(db: Executor, rows: InsertPhotoInput[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(petPhotos).values(rows);
}

/** R-16 — replacing the whole ordered set is delete-then-reinsert, one transaction. */
export async function deletePhotosByPetId(db: Executor, petId: string): Promise<void> {
  await db.delete(petPhotos).where(eq(petPhotos.petId, petId));
}

export interface UpdatePetPatch {
  name?: string;
  species?: Species;
  breed?: string | null;
  sex?: Sex;
  ageMonths?: number;
  size?: PetSize;
  weightGrams?: number | null;
  description?: string;
  city?: string;
  isVaccinated?: boolean;
  isNeutered?: boolean;
  isGoodWithKids?: boolean;
  isGoodWithPets?: boolean;
}

/** Scoped by `ownerId` — R-2: not the owner returns `undefined`, same as "doesn't exist". */
export async function update(
  db: Executor,
  petId: string,
  ownerId: string,
  patch: UpdatePetPatch,
  updatedAt: Date,
): Promise<{ id: string } | undefined> {
  if (Object.keys(patch).length === 0) {
    const [row] = await db
      .select({ id: pets.id })
      .from(pets)
      .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
      .limit(1);
    return row;
  }
  const [row] = await db
    .update(pets)
    .set({ ...patch, updatedAt })
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .returning({ id: pets.id });
  return row;
}

/** The pet's current status, scoped by owner (used to validate a legal transition before writing). */
export async function findOwnedStatus(
  db: Executor,
  petId: string,
  ownerId: string,
): Promise<PetStatus | undefined> {
  const [row] = await db
    .select({ status: pets.status })
    .from(pets)
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .limit(1);
  return row?.status;
}

export async function setStatus(
  db: Executor,
  petId: string,
  ownerId: string,
  status: PetStatus,
  updatedAt: Date,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .update(pets)
    .set({ status, updatedAt })
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .returning({ id: pets.id });
  return row;
}

/** R-17 — cascade to photos/requests/favourites is FK-level (data model §4); this is a plain delete. */
export async function deleteById(
  db: Executor,
  petId: string,
  ownerId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .delete(pets)
    .where(and(eq(pets.id, petId), eq(pets.ownerId, ownerId)))
    .returning({ id: pets.id });
  return row;
}
