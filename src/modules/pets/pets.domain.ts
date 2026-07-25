import { AGE_GROUP_MONTHS } from "#contracts";
import type { AgeGroup, PetStatus } from "#contracts";

// Architecture §2.1 — domain may import nothing from the app. Pure
// business rules only: no I/O, no Drizzle, no contracts-derived schemas
// (constants/types from @adopta/contracts are fine — the contract
// package is the one shared vocabulary, not "the app").

/** Contract §3.1 — translates an `ageGroup` filter into an inclusive `age_months` range. */
export function ageGroupRange(group: AgeGroup): readonly [number, number] {
  return AGE_GROUP_MONTHS[group];
}

/**
 * Contract §8.3 `pets.setStatus` legal-transitions table (rule R-5).
 * Defined here (pure data) even though `pets.setStatus` itself ships in
 * B6, so that module can import it rather than re-deriving the matrix.
 */
const LEGAL_TRANSITIONS: Record<PetStatus, readonly PetStatus[]> = {
  available: ["reserved", "adopted", "withdrawn"],
  reserved: ["available", "adopted", "withdrawn"],
  adopted: ["withdrawn"],
  withdrawn: ["available"],
};

export function isLegalTransition(from: PetStatus, to: PetStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

/** Contract §8.3 `pets.list` — statuses visible in any public list (rule R-1). */
export const PUBLIC_LIST_STATUSES = ["available", "reserved"] as const;
