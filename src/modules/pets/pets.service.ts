import { and, eq } from "drizzle-orm";
import { ResultAsync } from "neverthrow";
import { Uuidv7IdAdapter } from "../../adapters/uuidv7.adapter.js";
import { adoptionRequests } from "../../db/schema/adoption-requests.js";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../trpc/unwrap.js";
import { consumeUploads, verifyOwnedUnconsumed } from "../uploads/index.js";
import { isLegalTransition } from "./pets.domain.js";
import { mapOwnedPet, mapPet } from "./pets.mapper.js";
import * as repo from "./pets.repository.js";
import type {
  CreatePetInput,
  FieldError,
  OwnedPet,
  Pet,
  PetsListByOwnerInput,
  PetsListInput,
  PetsListMineInput,
  PetsSetStatusInput,
  PetsUpdateInput,
  PaginationMeta,
} from "#contracts";
import type { PetPhotoRow } from "./pets.mapper.js";
import type { Database, Executor } from "../../db/types.js";

const idPort = new Uuidv7IdAdapter();

// Architecture §2.1 — service may import own repository/mapper/domain
// and other modules' `index.ts`, not Drizzle. Returns
// `ResultAsync<T, AppError>`.

class PetNotFound extends Error {}

function paginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  return { page, perPage, total, totalPages: total === 0 ? 0 : Math.ceil(total / perPage) };
}

function photosFor(byPet: Map<string, PetPhotoRow[]>, petId: string): PetPhotoRow[] {
  return byPet.get(petId) ?? [];
}

export function list(
  db: Executor,
  input: PetsListInput,
  viewerId: string | null,
): ResultAsync<{ items: Pet[]; meta: PaginationMeta }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { items, total } = await repo.listPaginated(db, { ...input, viewerId });
      const photosByPet = await repo.findPhotosByPetIds(
        db,
        items.map((row) => row.id),
      );
      return {
        items: items.map((row) => mapPet(row, photosFor(photosByPet, row.id), row)),
        meta: paginationMeta(input.page, input.perPage, total),
      };
    })(),
    toAppError,
  );
}

/**
 * Visibility (R-2) is already baked into `findById`'s query — a row
 * that comes back nonexistent means "not visible to this caller", not
 * "exists but forbidden". There is no separate check-then-reject step.
 */
export function byId(
  db: Executor,
  petId: string,
  viewerId: string | null,
): ResultAsync<Pet, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const row = await repo.findById(db, petId, viewerId);
      if (!row) throw new PetNotFound();
      const photosByPet = await repo.findPhotosByPetIds(db, [row.id]);
      return mapPet(row, photosFor(photosByPet, row.id), row);
    })(),
    (cause) => (cause instanceof PetNotFound ? AppErrors.notFound("Pet") : toAppError(cause)),
  );
}

export function listByOwner(
  db: Executor,
  input: PetsListByOwnerInput,
  viewerId: string | null,
): ResultAsync<{ items: Pet[]; meta: PaginationMeta }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { items, total } = await repo.listByOwnerPaginated(
        db,
        input.ownerId,
        input.page,
        input.perPage,
        viewerId,
      );
      const photosByPet = await repo.findPhotosByPetIds(
        db,
        items.map((row) => row.id),
      );
      return {
        items: items.map((row) => mapPet(row, photosFor(photosByPet, row.id), row)),
        meta: paginationMeta(input.page, input.perPage, total),
      };
    })(),
    toAppError,
  );
}

export function listMine(
  db: Executor,
  ownerId: string,
  input: PetsListMineInput,
): ResultAsync<{ items: OwnedPet[]; meta: PaginationMeta }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { items, total } = await repo.listMinePaginated(db, ownerId, input);
      const photosByPet = await repo.findPhotosByPetIds(
        db,
        items.map((row) => row.id),
      );
      return {
        items: items.map((row) =>
          mapOwnedPet(row, photosFor(photosByPet, row.id), row, row.pendingRequestCount),
        ),
        meta: paginationMeta(input.page, input.perPage, total),
      };
    })(),
    toAppError,
  );
}

// --- Write side (B6) --------------------------------------------------

function weightKgToGrams(weightKg: number | null | undefined): number | null | undefined {
  if (weightKg === undefined) return undefined;
  return weightKg === null ? null : Math.round(weightKg * 1000);
}

/**
 * R-14/R-15: every `uploadId` must be owned by the caller and
 * unconsumed. Rejects via a `validation_error` with a field error on
 * the exact `photos[i].uploadId` path (contract §5.3), throwing
 * `DomainThrow` so callers can invoke this from inside or outside a
 * transaction uniformly.
 */
async function assertPhotosOwnedUnconsumed(
  db: Executor,
  photos: ReadonlyArray<{ uploadId: string }>,
  callerId: string,
): Promise<void> {
  const uploadIds = photos.map((p) => p.uploadId);
  const ownedResult = await verifyOwnedUnconsumed(db, uploadIds, callerId);
  if (ownedResult.isErr()) throw new DomainThrow(ownedResult.error);

  const owned = ownedResult.value;
  const fieldErrors: FieldError[] = [];
  uploadIds.forEach((uploadId, index) => {
    if (!owned.has(uploadId)) {
      fieldErrors.push({
        field: `photos[${index}].uploadId`,
        message: "Upload not found, not owned by you, or already attached to a pet",
      });
    }
  });
  if (fieldErrors.length > 0) {
    throw new DomainThrow(AppErrors.validation(fieldErrors));
  }
}

/**
 * Contract §8.3 `pets.create`. Ownership/consumption check happens
 * before the transaction (a pure read — nothing to roll back), then
 * insert pet + photos + mark uploads consumed all in one transaction
 * (architecture §7 last paragraph, R-14/R-15).
 */
export function create(
  db: Database,
  callerId: string,
  input: CreatePetInput,
): ResultAsync<Pet, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      await assertPhotosOwnedUnconsumed(db, input.photos, callerId);

      const petId = idPort.next();
      const now = new Date();

      const row = await db.transaction(async (tx) => {
        await repo.insert(tx, {
          id: petId,
          ownerId: callerId,
          name: input.name,
          species: input.species,
          breed: input.breed ?? null,
          sex: input.sex,
          ageMonths: input.ageMonths,
          size: input.size,
          weightGrams: weightKgToGrams(input.weightKg) ?? null,
          description: input.description,
          city: input.city,
          isVaccinated: input.isVaccinated,
          isNeutered: input.isNeutered,
          isGoodWithKids: input.isGoodWithKids,
          isGoodWithPets: input.isGoodWithPets,
          createdAt: now,
          updatedAt: now,
        });

        await repo.insertPhotos(
          tx,
          input.photos.map((photo, index) => ({
            id: idPort.next(),
            petId,
            uploadId: photo.uploadId,
            position: index,
            alt: photo.alt ?? null,
          })),
        );

        await consumeUploads(
          tx,
          input.photos.map((p) => p.uploadId),
          now,
        );

        const found = await repo.findById(tx, petId, callerId);
        if (!found) throw new DomainThrow(AppErrors.internal("Pet not found after insert"));
        return found;
      });

      const photosByPet = await repo.findPhotosByPetIds(db, [petId]);
      return mapPet(row, photosFor(photosByPet, petId), row);
    })(),
    toAppError,
  );
}

/**
 * Contract §8.3 `pets.update`. R-2: not the owner -> `not_found`, via
 * `repo.update`'s `ownerId`-scoped WHERE, never a post-fetch check. R-16:
 * if `photos` is present it replaces the whole ordered set inside the
 * same transaction as the field patch.
 */
export function update(
  db: Database,
  callerId: string,
  input: PetsUpdateInput,
): ResultAsync<Pet, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { petId, photos, ...rest } = input;

      if (photos) {
        await assertPhotosOwnedUnconsumed(db, photos, callerId);
      }

      const patch: repo.UpdatePetPatch = {};
      if (rest.name !== undefined) patch.name = rest.name;
      if (rest.species !== undefined) patch.species = rest.species;
      if (rest.breed !== undefined) patch.breed = rest.breed;
      if (rest.sex !== undefined) patch.sex = rest.sex;
      if (rest.ageMonths !== undefined) patch.ageMonths = rest.ageMonths;
      if (rest.size !== undefined) patch.size = rest.size;
      if (rest.weightKg !== undefined) patch.weightGrams = weightKgToGrams(rest.weightKg) ?? null;
      if (rest.description !== undefined) patch.description = rest.description;
      if (rest.city !== undefined) patch.city = rest.city;
      if (rest.isVaccinated !== undefined) patch.isVaccinated = rest.isVaccinated;
      if (rest.isNeutered !== undefined) patch.isNeutered = rest.isNeutered;
      if (rest.isGoodWithKids !== undefined) patch.isGoodWithKids = rest.isGoodWithKids;
      if (rest.isGoodWithPets !== undefined) patch.isGoodWithPets = rest.isGoodWithPets;

      const now = new Date();

      const row = await db.transaction(async (tx) => {
        const updated = await repo.update(tx, petId, callerId, patch, now);
        if (!updated) throw new DomainThrow(AppErrors.notFound("Pet"));

        if (photos) {
          await repo.deletePhotosByPetId(tx, petId);
          await repo.insertPhotos(
            tx,
            photos.map((photo, index) => ({
              id: idPort.next(),
              petId,
              uploadId: photo.uploadId,
              position: index,
              alt: photo.alt ?? null,
            })),
          );
          await consumeUploads(
            tx,
            photos.map((p) => p.uploadId),
            now,
          );
        }

        const found = await repo.findById(tx, petId, callerId);
        if (!found) throw new DomainThrow(AppErrors.notFound("Pet"));
        return found;
      });

      const photosByPet = await repo.findPhotosByPetIds(db, [petId]);
      return mapPet(row, photosFor(photosByPet, petId), row);
    })(),
    toAppError,
  );
}

/**
 * Contract §8.3 `pets.setStatus`. R-5: legal transitions only, checked
 * against `pets.domain.ts`'s `isLegalTransition`, inside the same
 * transaction that writes the new status (avoids a check-then-write
 * race). R-6: moving to `adopted` with `declinePendingRequests` (default
 * true) declines every `pending` request for the pet in that same
 * transaction. Follows architecture §6.2's `respond()` pattern exactly:
 * `DomainThrow` inside `db.transaction`, converted back to `Err` by
 * `toAppError` outside it.
 */
export function setStatus(
  db: Database,
  callerId: string,
  input: PetsSetStatusInput,
): ResultAsync<Pet, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();

      const row = await db.transaction(async (tx) => {
        const currentStatus = await repo.findOwnedStatus(tx, input.petId, callerId);
        if (!currentStatus) throw new DomainThrow(AppErrors.notFound("Pet"));

        if (!isLegalTransition(currentStatus, input.status)) {
          throw new DomainThrow(
            AppErrors.conflict(
              "invalid_transition",
              `Cannot move a pet from ${currentStatus} to ${input.status}`,
            ),
          );
        }

        const updated = await repo.setStatus(tx, input.petId, callerId, input.status, now);
        if (!updated) throw new DomainThrow(AppErrors.notFound("Pet"));

        if (input.status === "adopted" && input.declinePendingRequests) {
          await tx
            .update(adoptionRequests)
            .set({ status: "declined", respondedAt: now })
            .where(
              and(eq(adoptionRequests.petId, input.petId), eq(adoptionRequests.status, "pending")),
            );
        }

        const found = await repo.findById(tx, input.petId, callerId);
        if (!found) throw new DomainThrow(AppErrors.notFound("Pet"));
        return found;
      });

      const photosByPet = await repo.findPhotosByPetIds(db, [input.petId]);
      return mapPet(row, photosFor(photosByPet, input.petId), row);
    })(),
    toAppError,
  );
}

/** Contract §8.3 `pets.remove`. Hard delete; cascades to photos/requests/favourites (R-17, FK-level). */
export function remove(
  db: Database,
  callerId: string,
  petId: string,
): ResultAsync<{ id: string }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const deleted = await repo.deleteById(db, petId, callerId);
      if (!deleted) throw new DomainThrow(AppErrors.notFound("Pet"));
      return deleted;
    })(),
    toAppError,
  );
}
