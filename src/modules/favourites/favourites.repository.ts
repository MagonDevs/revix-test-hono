import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { user } from "../../db/schema/auth.js";
import { favourites } from "../../db/schema/favourites.js";
import { pets } from "../../db/schema/pets.js";
import type { Executor } from "../../db/types.js";
import type { PetRow, ViewerFlags } from "../pets/index.js";

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

export async function listPaginated(
  db: Executor,
  callerId: string,
  page: number,
  perPage: number,
): Promise<PageResult<FavouritedPetRow>> {
  const where = eq(favourites.userId, callerId);

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
    .where(where)
    .orderBy(desc(favourites.createdAt), desc(favourites.petId))
    .limit(perPage)
    .offset((page - 1) * perPage);

  const total = rows.length > 0 ? (rows[0]?.total ?? 0) : await countFavourites(db, where);
  const items = rows.map(({ total: _total, ...rest }) => ({
    ...rest,
    viewerRequestStatus: rest.viewerRequestStatus as ViewerFlags["viewerRequestStatus"],
  }));
  return { items, total };
}

async function countFavourites(db: Executor, where: SQL): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(favourites)
    .where(where);
  return row?.count ?? 0;
}

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
