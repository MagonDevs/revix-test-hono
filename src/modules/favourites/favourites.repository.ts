import { and, desc, eq, sql } from "drizzle-orm";
import { user } from "../../db/schema/auth.js";
import { favourites } from "../../db/schema/favourites.js";
import { pets } from "../../db/schema/pets.js";
import type { Executor } from "../../db/types.js";
import type { PetRow, ViewerFlags } from "../pets/index.js";

// Drizzle-only, own module types, no business rules beyond query shape
// (architecture §2.1). Composite PK on (user_id, pet_id) — data model
// §5.2 — is what makes `set()` a plain upsert/delete, idempotent by
// construction (R-18), no application-level idempotency logic needed.

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

/**
 * §8.5's `viewerRequestStatus` is still per-caller here even though
 * `isFavourited` is trivially `true` for every row — the caller may have
 * an active/past adoption request on a pet they favourited (R-20).
 */
function viewerRequestStatusField(callerId: string) {
  return sql<string | null>`(
    select ar.status from adoption_requests ar
    where ar.pet_id = ${pets.id} and ar.adopter_id = ${callerId}
    order by ar.created_at desc limit 1
  )`;
}

export type FavouritedPetRow = PetRow & ViewerFlags;

export interface PageResult<T> {
  items: T[];
  total: number;
}

/**
 * Contract §8.5 `favourites.list` — "in any status" is deliberate (the
 * client still shows pets the caller favourited even after they're
 * adopted/withdrawn), so unlike `pets.list` there is no status filter
 * here. Ordered newest-favourited-first. Favourites IS the entity being
 * paginated with its pet attached, so this is a single join rather than
 * the id-then-fetch two-query shape — photos are still fetched in a
 * follow-up query by the caller (pets module's `findPhotosByPetIds`),
 * same no-N+1 discipline as B5.
 */
export async function listPaginated(
  db: Executor,
  callerId: string,
  page: number,
  perPage: number,
): Promise<PageResult<FavouritedPetRow>> {
  const rows = await db
    .select({
      ...petFields,
      guardian: guardianFields,
      isFavourited: sql<boolean>`true`,
      viewerRequestStatus: viewerRequestStatusField(callerId),
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(favourites)
    .innerJoin(pets, eq(favourites.petId, pets.id))
    .innerJoin(user, eq(pets.ownerId, user.id))
    .where(eq(favourites.userId, callerId))
    .orderBy(desc(favourites.createdAt), desc(favourites.petId))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const total = rows[0]?.total ?? 0;
  const items = rows.map(({ total: _total, ...rest }) => ({
    ...rest,
    viewerRequestStatus: rest.viewerRequestStatus as ViewerFlags["viewerRequestStatus"],
  }));
  return { items, total };
}

/**
 * R-18 — idempotent by construction via the composite PK: `true` is an
 * upsert that no-ops on conflict, `false` is a plain delete that no-ops
 * when the row doesn't exist. No read-before-write, no application-level
 * idempotency check.
 */
export async function set(
  db: Executor,
  userId: string,
  petId: string,
  favourited: boolean,
): Promise<void> {
  if (favourited) {
    await db.insert(favourites).values({ userId, petId }).onConflictDoNothing();
  } else {
    await db
      .delete(favourites)
      .where(and(eq(favourites.userId, userId), eq(favourites.petId, petId)));
  }
}
