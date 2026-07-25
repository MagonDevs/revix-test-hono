import { ResultAsync } from "neverthrow";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { toAppError } from "../../trpc/unwrap.js";
import { mapOwnedPet, mapPet } from "./pets.mapper.js";
import * as repo from "./pets.repository.js";
import type { PetPhotoRow } from "./pets.mapper.js";
import type { Executor } from "../../db/types.js";
import type {
  OwnedPet,
  Pet,
  PetsListByOwnerInput,
  PetsListInput,
  PetsListMineInput,
  PaginationMeta,
} from "@adopta/contracts";

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
