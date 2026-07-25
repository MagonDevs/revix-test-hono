import { and, count, eq } from "drizzle-orm";
import { user } from "../../db/schema/auth.js";
import { pets } from "../../db/schema/pets.js";
import type { UserRow } from "./users.mapper.js";
import type { Executor } from "../../db/types.js";

// Architecture §6 — router -> service -> repository. `pets` is read
// directly here (rather than through a not-yet-existing pets module)
// only for the `availablePetCount` count query — the one legitimate
// cross-cutting read called out in the B3 task brief.

export async function findUserById(db: Executor, userId: string): Promise<UserRow | undefined> {
  const [row] = await db.select().from(user).where(eq(user.id, userId)).limit(1);
  return row;
}

export async function countAvailablePets(db: Executor, ownerId: string): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(pets)
    .where(and(eq(pets.ownerId, ownerId), eq(pets.status, "available")));
  return row?.value ?? 0;
}

export interface UserUpdatePatch {
  name?: string;
  city?: string;
  phone?: string | null;
  bio?: string | null;
  image?: string | null;
}

export async function updateUser(
  db: Executor,
  userId: string,
  patch: UserUpdatePatch,
): Promise<UserRow | undefined> {
  const [row] = await db
    .update(user)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(user.id, userId))
    .returning();
  return row;
}
