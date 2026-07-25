import { ResultAsync } from "neverthrow";
import { v7 as uuidv7 } from "uuid";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import { findVisiblePet, isLegalTransition, setPetStatusInTx } from "../pets/index.js";
import { mapAdoptionRequest } from "./adoption-requests.mapper.js";
import * as repo from "./adoption-requests.repository.js";
import type {
  AdoptionRequest,
  AdoptionRequestsCreateInput,
  AdoptionRequestsListInput,
  AdoptionRequestsRespondInput,
  PaginationMeta,
} from "#contracts";
import type { AdoptionRequestRow } from "./adoption-requests.mapper.js";
import type { Database, Executor } from "../../db/types.js";
import type { IdPort } from "../../ports/id.port.js";

const idPort: IdPort = { next: () => uuidv7() };

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
