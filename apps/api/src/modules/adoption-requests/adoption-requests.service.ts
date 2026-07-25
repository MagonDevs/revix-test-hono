import { ResultAsync } from "neverthrow";
import { Uuidv7IdAdapter } from "../../adapters/uuidv7.adapter.js";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../trpc/unwrap.js";
import { findVisiblePet, isLegalTransition, setPetStatusInTx } from "../pets/index.js";
import { mapAdoptionRequest } from "./adoption-requests.mapper.js";
import * as repo from "./adoption-requests.repository.js";
import type { AdoptionRequestRow } from "./adoption-requests.mapper.js";
import type { Database, Executor } from "../../db/types.js";
import type {
  AdoptionRequest,
  AdoptionRequestsCreateInput,
  AdoptionRequestsListInput,
  AdoptionRequestsRespondInput,
  PaginationMeta,
} from "@adopta/contracts";

const idPort = new Uuidv7IdAdapter();

// Architecture §2.1 — service may import own repository/mapper and other
// modules' `index.ts`, not Drizzle. Returns `ResultAsync<T, AppError>`.

function paginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  return { page, perPage, total, totalPages: total === 0 ? 0 : Math.ceil(total / perPage) };
}

async function toContract(
  db: Executor,
  row: AdoptionRequestRow,
  callerId: string,
): Promise<AdoptionRequest> {
  const coverPhotos = await repo.findCoverPhotosByPetIds(db, [row.pet.id]);
  return mapAdoptionRequest(row, coverPhotos.get(row.pet.id) ?? null, callerId);
}

/**
 * Contract §8.4 `adoptionRequests.create`. Order of checks matches the
 * contract's table exactly: visibility (via `pets/index.ts`, R-2's own
 * predicate — a pet not visible comes back `not_found`), then R-7
 * (self-request), then R-8 (duplicate active request — declined/withdrawn
 * do NOT block), then R-9 (pet adopted/withdrawn). All pure reads, so no
 * transaction is needed until the insert itself.
 */
export function create(
  db: Database,
  callerId: string,
  input: AdoptionRequestsCreateInput,
): ResultAsync<AdoptionRequest, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const pet = await findVisiblePet(db, input.petId, callerId);
      if (!pet) throw new DomainThrow(AppErrors.notFound("Pet"));

      if (pet.guardian.id === callerId) {
        throw new DomainThrow(
          AppErrors.conflict("self_request", "You cannot request your own pet"),
        );
      }

      const active = await repo.findActiveByPetAndAdopter(db, input.petId, callerId);
      if (active) {
        throw new DomainThrow(
          AppErrors.conflict(
            "duplicate_request",
            "You already have an active request for this pet",
          ),
        );
      }

      if (pet.status === "adopted" || pet.status === "withdrawn") {
        throw new DomainThrow(AppErrors.conflict("pet_unavailable", "This pet is not available"));
      }

      const requestId = idPort.next();
      const now = new Date();
      await repo.insert(db, {
        id: requestId,
        petId: input.petId,
        adopterId: callerId,
        guardianId: pet.guardian.id,
        message: input.message,
        createdAt: now,
      });

      const row = await repo.findByIdWithParties(db, requestId, callerId);
      if (!row)
        throw new DomainThrow(AppErrors.internal("Adoption request not found after insert"));
      return toContract(db, row, callerId);
    })(),
    toAppError,
  );
}

/** Contract §8.4 `adoptionRequests.list` — role-scoped (no default), R-10 ordering. */
export function list(
  db: Executor,
  callerId: string,
  input: AdoptionRequestsListInput,
): ResultAsync<{ items: AdoptionRequest[]; meta: PaginationMeta }, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const { items, total } = await repo.listPaginated(db, {
        role: input.role,
        callerId,
        status: input.status,
        petId: input.petId,
        page: input.page,
        perPage: input.perPage,
      });
      const coverPhotos = await repo.findCoverPhotosByPetIds(
        db,
        items.map((row) => row.pet.id),
      );
      return {
        items: items.map((row) =>
          mapAdoptionRequest(row, coverPhotos.get(row.pet.id) ?? null, callerId),
        ),
        meta: paginationMeta(input.page, input.perPage, total),
      };
    })(),
    toAppError,
  );
}

/** Contract §8.4 `adoptionRequests.byId` — R-11: non-parties get `not_found`, via query scoping. */
export function byId(
  db: Executor,
  callerId: string,
  requestId: string,
): ResultAsync<AdoptionRequest, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const row = await repo.findByIdWithParties(db, requestId, callerId);
      if (!row) throw new DomainThrow(AppErrors.notFound("Adoption request"));
      return toContract(db, row, callerId);
    })(),
    toAppError,
  );
}

/**
 * Contract §8.4 `adoptionRequests.respond`. THE concurrency-critical
 * procedure (R-12/R-13, architecture §6). `findByIdForUpdate` takes a
 * row lock inside the transaction, so two simultaneous calls serialize:
 * the first to commit wins, the second observes `status !== 'pending'`
 * and fails with `request_already_answered` — never both winning.
 *
 * R-13: `reservePet` moves the pet to `reserved` in the SAME transaction,
 * via `pets/index.ts`'s tx-aware `setPetStatusInTx` (the repository-level
 * write, not `pets.service.setStatus`, which owns its own transaction
 * boundary and can't be nested here). An illegal transition throws and
 * rolls back the whole operation, including the request's status write.
 */
export function respond(
  db: Database,
  callerId: string,
  input: AdoptionRequestsRespondInput,
): ResultAsync<AdoptionRequest, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();

      await db.transaction(async (tx) => {
        const request = await repo.findByIdForUpdate(tx, input.requestId);
        if (!request) throw new DomainThrow(AppErrors.notFound("Adoption request"));
        if (request.guardianId !== callerId) {
          throw new DomainThrow(AppErrors.notFound("Adoption request"));
        }
        if (request.status !== "pending") {
          throw new DomainThrow(
            AppErrors.conflict(
              "request_already_answered",
              "This request has already been answered",
            ),
          );
        }

        await repo.setStatus(tx, request.id, input.status, now);

        if (input.status === "accepted" && input.reservePet) {
          const currentPet = await findVisiblePet(tx, request.petId, callerId);
          if (!currentPet || !isLegalTransition(currentPet.status, "reserved")) {
            throw new DomainThrow(
              AppErrors.conflict("invalid_transition", `Cannot move this pet to reserved`),
            );
          }
          const reserved = await setPetStatusInTx(
            tx,
            request.petId,
            request.guardianId,
            "reserved",
            now,
          );
          if (!reserved) {
            throw new DomainThrow(AppErrors.notFound("Pet"));
          }
        }
      });

      const row = await repo.findByIdWithParties(db, input.requestId, callerId);
      if (!row)
        throw new DomainThrow(AppErrors.internal("Adoption request not found after respond"));
      return toContract(db, row, callerId);
    })(),
    toAppError,
  );
}

/** Contract §8.4 `adoptionRequests.withdraw` — caller must be the adopter, only from `pending`. */
export function withdraw(
  db: Database,
  callerId: string,
  requestId: string,
): ResultAsync<AdoptionRequest, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const now = new Date();

      await db.transaction(async (tx) => {
        const request = await repo.findByIdForUpdate(tx, requestId);
        if (!request) throw new DomainThrow(AppErrors.notFound("Adoption request"));
        if (request.adopterId !== callerId) {
          throw new DomainThrow(AppErrors.notFound("Adoption request"));
        }
        if (request.status !== "pending") {
          throw new DomainThrow(
            AppErrors.conflict(
              "request_already_answered",
              "This request has already been answered",
            ),
          );
        }
        await repo.setStatus(tx, request.id, "withdrawn", now);
      });

      const row = await repo.findByIdWithParties(db, requestId, callerId);
      if (!row)
        throw new DomainThrow(AppErrors.internal("Adoption request not found after withdraw"));
      return toContract(db, row, callerId);
    })(),
    toAppError,
  );
}
