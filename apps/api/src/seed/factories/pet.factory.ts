import { breedFor } from "../data/breeds.js";
import { composeDescription } from "../data/descriptions.js";
import { nameFor } from "../data/names.js";
import type { PetSize, PetStatus, Sex, Species } from "@adopta/contracts";

// Direct-insert row shape for `pets` (db/schema/pets.ts). Unlike users,
// pets/requests/favourites ARE fine as direct inserts — spec §2 only
// singles out users because Better Auth owns the auth-table invariants.

export interface PetRow {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: Sex;
  ageMonths: number;
  size: PetSize;
  weightGrams: number | null;
  description: string;
  city: string;
  status: PetStatus;
  isVaccinated: boolean;
  isNeutered: boolean;
  isGoodWithKids: boolean;
  isGoodWithPets: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BuildPetInput {
  id: string;
  ownerId: string;
  index: number; // deterministic index within species, drives name/breed/description
  species: Species;
  breed?: string | null;
  sex: Sex;
  ageMonths: number;
  size: PetSize;
  weightGrams?: number | null;
  city: string;
  status: PetStatus;
  createdAt: Date;
  updatedAt?: Date;
  isVaccinated?: boolean;
  isNeutered?: boolean;
  isGoodWithKids?: boolean;
  isGoodWithPets?: boolean;
  /** Override the composed description (used by the `edge` scenario for boundary lengths). */
  description?: string;
  /** Override the name (used by the `edge` scenario for 2/40-char boundaries). */
  name?: string;
}

export function buildPet(input: BuildPetInput): PetRow {
  const name = input.name ?? nameFor(input.species, input.index);
  const breed = input.breed !== undefined ? input.breed : breedFor(input.species, input.index);
  const description =
    input.description ??
    composeDescription(name, input.city, {
      opener: input.index,
      temperament: input.index + 1,
      practical: input.index + 2,
      closer: input.index + 3,
    });

  return {
    id: input.id,
    ownerId: input.ownerId,
    name,
    species: input.species,
    breed,
    sex: input.sex,
    ageMonths: input.ageMonths,
    size: input.size,
    weightGrams: input.weightGrams ?? null,
    description,
    city: input.city,
    status: input.status,
    isVaccinated: input.isVaccinated ?? true,
    isNeutered: input.isNeutered ?? true,
    isGoodWithKids: input.isGoodWithKids ?? false,
    isGoodWithPets: input.isGoodWithPets ?? false,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
  };
}

/** Spec §5.3 — 1 photo (20%), 2-3 (55%), 4-6 (25%), picked from a unit interval. */
export function photoCountFor(unitInterval: number): number {
  if (unitInterval < 0.2) return 1;
  if (unitInterval < 0.75) return unitInterval < 0.475 ? 2 : 3;
  // remaining 25%, spread across 4-6
  const t = (unitInterval - 0.75) / 0.25; // 0..1
  if (t < 1 / 3) return 4;
  if (t < 2 / 3) return 5;
  return 6;
}

/** Landscape/portrait alternate per spec §5.3, keyed off absolute photo position. */
export function dimensionsFor(position: number): { width: number; height: number } {
  return position % 2 === 0 ? { width: 1200, height: 900 } : { width: 900, height: 1200 };
}
