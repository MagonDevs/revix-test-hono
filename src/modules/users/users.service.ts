import { ResultAsync } from "neverthrow";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { DomainThrow, toAppError } from "../../errors/domain-throw.js";
import { verifyOwned } from "../uploads/index.js";
import { mapSessionUser, mapUserProfile } from "./users.mapper.js";
import * as repo from "./users.repository.js";
import type { SessionUser, UserProfile, UsersUpdateMeInput } from "#contracts";
import type { UserUpdatePatch } from "./users.repository.js";
import type { Executor } from "../../db/types.js";

// Architecture §6 — services return `ResultAsync<T, AppError>`.

class UserNotFound extends Error {}

export function getUserProfile(db: Executor, userId: string): ResultAsync<UserProfile, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const row = await repo.findUserById(db, userId);
      if (!row) throw new UserNotFound();
      const availablePetCount = await repo.countAvailablePets(db, userId);
      return mapUserProfile(row, availablePetCount);
    })(),
    (cause) => (cause instanceof UserNotFound ? AppErrors.notFound("User") : toAppError(cause)),
  );
}

/**
 * `undefined` (field omitted from input) means "unchanged"; explicit
 * `null` means "clear it" — contract §8.2. `avatarUploadId`: R-15 — a
 * non-null id must be owned by the caller (checked via the uploads
 * module's public API, same cross-module pattern B6 used for pet
 * photos), and resolves to the upload's public URL, the same
 * `/api/v1/uploads/<id>/raw` shape `uploads.service.toUploadOutput` uses.
 * Unlike pet photos, an avatar isn't tracked by `consumedAt` — reusing
 * or re-setting an upload here never errors.
 */
export function updateMe(
  db: Executor,
  userId: string,
  input: UsersUpdateMeInput,
): ResultAsync<SessionUser, AppError> {
  return ResultAsync.fromPromise(
    (async () => {
      const patch: UserUpdatePatch = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.city !== undefined) patch.city = input.city;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.bio !== undefined) patch.bio = input.bio;

      if (input.avatarUploadId !== undefined) {
        if (input.avatarUploadId === null) {
          patch.image = null;
        } else {
          const ownedResult = await verifyOwned(db, input.avatarUploadId, userId);
          if (ownedResult.isErr()) throw new DomainThrow(ownedResult.error);
          if (!ownedResult.value) {
            throw new DomainThrow(
              AppErrors.invalidField("avatarUploadId", "Upload not found or not owned by you"),
            );
          }
          patch.image = `/api/v1/uploads/${input.avatarUploadId}/raw`;
        }
      }

      const row = await repo.updateUser(db, userId, patch);
      if (!row) throw new UserNotFound();
      const availablePetCount = await repo.countAvailablePets(db, userId);
      return mapSessionUser(row, availablePetCount);
    })(),
    (cause) => (cause instanceof UserNotFound ? AppErrors.notFound("User") : toAppError(cause)),
  );
}
