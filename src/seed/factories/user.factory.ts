import { eq } from "drizzle-orm";
import { user as userTable } from "../../db/schema/auth.js";
import { updateUser } from "../../modules/users/users.repository.js";
import { avatarUrlFor } from "../images/providers.js";
import type { Executor } from "../../db/types.js";
import type { auth } from "../../modules/auth/auth.config.js";

// Spec §2: "Users are created through Better Auth's API, never by
// inserting rows." A direct insert into `user` produces an account with
// no `account` row and no password hash — it cannot log in. This
// factory always goes through `auth.api.signUpEmail`.
//
// `phone`/`bio`/`image` are `input: false` in auth.config.ts (they are
// not sign-up inputs), so setting them is a follow-up `updateUser` call
// through the same repository production code uses — not a raw insert,
// and consistent with how a real user would fill in their profile after
// registering.

export interface UserFactoryInput {
  name: string;
  email: string;
  password: string;
  city: string;
  phone?: string | null;
  bio?: string | null;
  avatar?: boolean; // defaults to true — dicebear URL per spec §5.3
}

export interface SeededUser {
  id: string;
  name: string;
  email: string;
  city: string;
}

export async function createSeedUser(
  authInstance: typeof auth,
  db: Executor,
  input: UserFactoryInput,
): Promise<SeededUser> {
  // Idempotency (spec §1): re-running the seed must never duplicate
  // rows. Better Auth rejects a sign-up for an email that already
  // exists, so a second run looks the existing row up instead of
  // treating that as a failure.
  const [existing] = await db
    .select()
    .from(userTable)
    .where(eq(userTable.email, input.email))
    .limit(1);

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const result = await authInstance.api.signUpEmail({
      body: {
        name: input.name,
        email: input.email,
        password: input.password,
        city: input.city,
      },
    });
    userId = result.user.id;
  }

  const patch: { phone?: string | null; bio?: string | null; image?: string | null } = {};
  if (input.phone !== undefined) patch.phone = input.phone;
  if (input.bio !== undefined) patch.bio = input.bio;
  if (input.avatar !== false) patch.image = avatarUrlFor(userId);

  if (Object.keys(patch).length > 0) {
    await updateUser(db, userId, patch);
  }

  return { id: userId, name: input.name, email: input.email, city: input.city };
}
