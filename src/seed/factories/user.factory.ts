import { eq } from "drizzle-orm";
import { user as userTable } from "../../db/schema/auth.js";
import { updateUser } from "../../modules/users/users.repository.js";
import { avatarUrlFor } from "../images/providers.js";
import type { Executor } from "../../db/types.js";
import type { auth } from "../../modules/auth/auth.config.js";

export interface UserFactoryInput {
  name: string;
  email: string;
  password: string;
  city: string;
  phone?: string | null;
  bio?: string | null;
  avatar?: boolean;
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
