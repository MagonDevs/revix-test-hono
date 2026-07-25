import { and, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { adoptionRequests } from "../../db/schema/adoption-requests.js";
import { user } from "../../db/schema/auth.js";
import { petPhotos } from "../../db/schema/pet-photos.js";
import { pets } from "../../db/schema/pets.js";
import { uploads } from "../../db/schema/uploads.js";
import type { RequestRole, RequestStatus } from "#contracts";
import type { AdoptionRequestRow } from "./adoption-requests.mapper.js";
import type { Executor } from "../../db/types.js";
import type { PetPhotoRow } from "../pets/index.js";

const adopterUser = alias(user, "adopter_user");
const guardianUser = alias(user, "guardian_user");

function partyFields(table: typeof user) {
  return {
    id: table.id,
    name: table.name,
    email: table.email,
    image: table.image,
    city: table.city,
    phone: table.phone,
    bio: table.bio,
    createdAt: table.createdAt,
  };
}

export interface InsertAdoptionRequestInput {
  id: string;
  petId: string;
  adopterId: string;
  guardianId: string;
  message: string;
  createdAt: Date;
}

export async function insert(db: Executor, input: InsertAdoptionRequestInput): Promise<void> {
  await db.insert(adoptionRequests).values({
    id: input.id,
    petId: input.petId,
    adopterId: input.adopterId,
    guardianId: input.guardianId,
    message: input.message,
    status: "pending",
    createdAt: input.createdAt,
  });
}

export interface RawRequestRow {
  id: string;
  petId: string;
  adopterId: string;
  guardianId: string;
  message: string;
  status: RequestStatus;
  createdAt: Date;
  respondedAt: Date | null;
}

export async function findByIdForUpdate(
  db: Executor,
  requestId: string,
): Promise<RawRequestRow | undefined> {
  const [row] = await db
    .select()
    .from(adoptionRequests)
    .where(eq(adoptionRequests.id, requestId))
    .for("update")
    .limit(1);
  return row;
}

export async function findByIdWithParties(
  db: Executor,
  requestId: string,
  callerId: string,
): Promise<AdoptionRequestRow | undefined> {
  const [row] = await db
    .select({
      id: adoptionRequests.id,
      status: adoptionRequests.status,
      message: adoptionRequests.message,
      createdAt: adoptionRequests.createdAt,
      respondedAt: adoptionRequests.respondedAt,
      pet: { id: pets.id, name: pets.name, status: pets.status },
      adopter: partyFields(adopterUser as unknown as typeof user),
      guardian: partyFields(guardianUser as unknown as typeof user),
    })
    .from(adoptionRequests)
    .innerJoin(pets, eq(adoptionRequests.petId, pets.id))
    .innerJoin(
      adopterUser as unknown as typeof user,
      eq(adoptionRequests.adopterId, adopterUser.id),
    )
    .innerJoin(
      guardianUser as unknown as typeof user,
      eq(adoptionRequests.guardianId, guardianUser.id),
    )
    .where(
      and(
        eq(adoptionRequests.id, requestId),
        or(eq(adoptionRequests.adopterId, callerId), eq(adoptionRequests.guardianId, callerId)),
      ),
    )
    .limit(1);

  return row;
}

export async function setStatus(
  db: Executor,
  requestId: string,
  status: RequestStatus,
  respondedAt: Date,
): Promise<{ id: string; adopterId: string } | undefined> {
  const [row] = await db
    .update(adoptionRequests)
    .set({ status, respondedAt })
    .where(eq(adoptionRequests.id, requestId))
    .returning({ id: adoptionRequests.id, adopterId: adoptionRequests.adopterId });
  return row;
}

export async function findActiveByPetAndAdopter(
  db: Executor,
  petId: string,
  adopterId: string,
): Promise<{ id: string } | undefined> {
  const [row] = await db
    .select({ id: adoptionRequests.id })
    .from(adoptionRequests)
    .where(
      and(
        eq(adoptionRequests.petId, petId),
        eq(adoptionRequests.adopterId, adopterId),
        inArray(adoptionRequests.status, ["pending", "accepted"]),
      ),
    )
    .limit(1);
  return row;
}

export interface AdoptionRequestsListFilters {
  role: RequestRole;
  callerId: string;
  status?: RequestStatus | undefined;
  petId?: string | undefined;
  page: number;
  perPage: number;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export async function listPaginated(
  db: Executor,
  filters: AdoptionRequestsListFilters,
): Promise<PageResult<AdoptionRequestRow>> {
  const conditions: SQL[] = [
    filters.role === "guardian"
      ? eq(adoptionRequests.guardianId, filters.callerId)
      : eq(adoptionRequests.adopterId, filters.callerId),
  ];
  if (filters.status) conditions.push(eq(adoptionRequests.status, filters.status));
  if (filters.petId) conditions.push(eq(adoptionRequests.petId, filters.petId));
  const where = and(...conditions) as SQL;

  const rows = await db
    .select({
      id: adoptionRequests.id,
      status: adoptionRequests.status,
      message: adoptionRequests.message,
      createdAt: adoptionRequests.createdAt,
      respondedAt: adoptionRequests.respondedAt,
      pet: { id: pets.id, name: pets.name, status: pets.status },
      adopter: partyFields(adopterUser as unknown as typeof user),
      guardian: partyFields(guardianUser as unknown as typeof user),
      total: sql<number>`count(*) over()`.mapWith(Number),
    })
    .from(adoptionRequests)
    .innerJoin(pets, eq(adoptionRequests.petId, pets.id))
    .innerJoin(
      adopterUser as unknown as typeof user,
      eq(adoptionRequests.adopterId, adopterUser.id),
    )
    .innerJoin(
      guardianUser as unknown as typeof user,
      eq(adoptionRequests.guardianId, guardianUser.id),
    )
    .where(where)
    .orderBy(
      sql`(${adoptionRequests.status} = 'pending') desc`,
      desc(adoptionRequests.createdAt),
      desc(adoptionRequests.id),
    )
    .limit(filters.perPage)
    .offset((filters.page - 1) * filters.perPage);

  const total = rows.length > 0 ? (rows[0]?.total ?? 0) : await countAdoptionRequests(db, where);
  const items = rows.map(({ total: _total, ...rest }) => rest);
  return { items, total };
}

async function countAdoptionRequests(db: Executor, where: SQL): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(adoptionRequests)
    .where(where);
  return row?.count ?? 0;
}

export async function declinePendingForPet(
  db: Executor,
  petId: string,
  respondedAt: Date,
): Promise<void> {
  await db
    .update(adoptionRequests)
    .set({ status: "declined", respondedAt })
    .where(and(eq(adoptionRequests.petId, petId), eq(adoptionRequests.status, "pending")));
}

export async function findCoverPhotosByPetIds(
  db: Executor,
  petIds: string[],
): Promise<Map<string, PetPhotoRow>> {
  const byPet = new Map<string, PetPhotoRow>();
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
    .where(and(inArray(petPhotos.petId, petIds), eq(petPhotos.position, 0)));

  for (const row of rows) {
    byPet.set(row.petId, {
      id: row.id,
      alt: row.alt,
      position: row.position,
      uploadId: row.uploadId,
      width: row.width,
      height: row.height,
    });
  }
  return byPet;
}
