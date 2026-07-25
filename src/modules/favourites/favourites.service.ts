import { ResultAsync } from "neverthrow";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import { findPhotosByPetIds, findVisiblePet, mapPet } from "../pets/index.js";
import * as repo from "./favourites.repository.js";
import type { FavouritesSetOutput, Pet, PaginationMeta } from "#contracts";
import type { Executor } from "../../db/types.js";

// Architecture §2.1 — service may import own repository and other
// modules' `index.ts`, not Drizzle. Returns `ResultAsync<T, AppError>`.

function paginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  return { page, perPage, total, totalPages: total === 0 ? 0 : Math.ceil(total / perPage) };
}

/**
 * Contract §8.5 `favourites.set`. The pet must be visible to the caller
 * (same predicate `adoptionRequests.create` uses via `findVisiblePet`)
 * or this returns `not_found` — a stranger can't discover a hidden pet's
 * id just by favouriting it. The write itself is idempotent by
 * construction (R-18, composite PK) — no pre-check needed there. Echoes
 * the input back per contract.
 */
export function set(
  db: Executor,
  callerId: string,
  petId: string,
  favourited: boolean,
): ResultAsync<FavouritesSetOutput, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const pet = await findVisiblePet(db, petId, callerId);
      if (!pet) throw new DomainThrow(AppErrors.notFound("Pet"));

      await repo.set(db, callerId, petId, favourited);
      return { petId, favourited };
    })(),
    toAppError,
  );
}

/** Contract §8.5 `favourites.list` — newest-favourited-first, any pet status. */
export function list(
  db: Executor,
  callerId: string,
  page: number,
  perPage: number,
): ResultAsync<{ items: Pet[]; meta: PaginationMeta }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { items, total } = await repo.listPaginated(db, callerId, page, perPage);
      const photosByPet = await findPhotosByPetIds(
        db,
        items.map((row) => row.id),
      );
      return {
        items: items.map((row) => mapPet(row, photosByPet.get(row.id) ?? [], row)),
        meta: paginationMeta(page, perPage, total),
      };
    })(),
    toAppError,
  );
}
