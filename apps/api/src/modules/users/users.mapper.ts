import type { SessionUser, UserProfile, UserSummary } from "@adopta/contracts";

// Pure rows -> contract output mappers (architecture §3 layer rules).
// R-22: email/phone appear ONLY on SessionUser — mapUserSummary and
// mapUserProfile must never read/return them.

/** Shape of a row read from the `user` table (db/schema/auth.ts). */
export interface UserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  city: string;
  phone: string | null;
  bio: string | null;
  createdAt: Date;
}

export function mapUserSummary(row: UserRow): UserSummary {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    avatarUrl: row.image ?? null,
    createdAt: row.createdAt,
  };
}

export function mapUserProfile(row: UserRow, availablePetCount: number): UserProfile {
  return {
    ...mapUserSummary(row),
    bio: row.bio ?? null,
    availablePetCount,
  };
}

export function mapSessionUser(row: UserRow, availablePetCount: number): SessionUser {
  return {
    ...mapUserProfile(row, availablePetCount),
    email: row.email,
    phone: row.phone ?? null,
  };
}
