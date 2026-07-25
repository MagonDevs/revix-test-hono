import { ResultAsync } from "neverthrow";
import { AppErrors, type AppError } from "../../errors/app-error.js";
import { toAppError } from "../../trpc/unwrap.js";
import { mapSessionUser, mapUserProfile } from "./users.mapper.js";
import * as repo from "./users.repository.js";
import type { UserUpdatePatch } from "./users.repository.js";
import type { Executor } from "../../db/types.js";
import type { SessionUser, UserProfile, UsersUpdateMeInput } from "@adopta/contracts";

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
 * `null` means "clear it" — contract §8.2. `avatarUploadId`: TODO(B6) —
 * the uploads module (and R-15's ownership check) doesn't exist yet, so
 * this is wired straight through to `user.image` as the raw upload id
 * rather than a resolved public URL, with no ownership verification.
 * Must be replaced once uploads land.
 */
export function updateMe(
  db: Executor,
  userId: string,
  input: UsersUpdateMeInput,
): ResultAsync<SessionUser, AppError> {
  const patch: UserUpdatePatch = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.city !== undefined) patch.city = input.city;
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.bio !== undefined) patch.bio = input.bio;
  // TODO(B6): resolve avatarUploadId -> the upload's public URL, and
  // verify the upload belongs to `userId` (R-15), before assigning it.
  if (input.avatarUploadId !== undefined) patch.image = input.avatarUploadId;

  return ResultAsync.fromPromise(
    (async () => {
      const row = await repo.updateUser(db, userId, patch);
      if (!row) throw new UserNotFound();
      const availablePetCount = await repo.countAvailablePets(db, userId);
      return mapSessionUser(row, availablePetCount);
    })(),
    (cause) => (cause instanceof UserNotFound ? AppErrors.notFound("User") : toAppError(cause)),
  );
}
