import { ResultAsync } from "neverthrow";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import { findPhotosByPetIds, findVisiblePet, mapPet } from "../pets/index.js";
import * as repo from "./favourites.repository.js";
import type { FavouritesSetOutput, Pet, PaginationMeta } from "#contracts";
import type { Executor } from "../../db/types.js";

function paginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  return { page, perPage, total, totalPages: total === 0 ? 0 : Math.ceil(total / perPage) };
}

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
