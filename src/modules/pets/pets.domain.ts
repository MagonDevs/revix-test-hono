import { AGE_GROUP_MONTHS } from "#contracts";
import type { AgeGroup, PetStatus } from "#contracts";

export function ageGroupRange(group: AgeGroup): readonly [number, number] {
  return AGE_GROUP_MONTHS[group];
}

const LEGAL_TRANSITIONS: Record<PetStatus, readonly PetStatus[]> = {
  available: ["reserved", "adopted", "withdrawn"],
  reserved: ["available", "adopted", "withdrawn"],
  adopted: ["withdrawn"],
  withdrawn: ["available"],
};

export function isLegalTransition(from: PetStatus, to: PetStatus): boolean {
  return LEGAL_TRANSITIONS[from].includes(to);
}

export const PUBLIC_LIST_STATUSES = ["available", "reserved"] as const;
