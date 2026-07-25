import { BREEDS_BY_SPECIES } from "../../modules/meta/index.js";
import { composeDescription } from "../data/descriptions.js";
import { nameFor } from "../data/names.js";
import { at } from "../util.js";
import type { PetSize, PetStatus, Sex, Species } from "#contracts";

function breedFor(species: Species, index: number): string {
  const list = BREEDS_BY_SPECIES[species];
  return at(list, index % list.length, "breed list");
}

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
  index: number;
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
  description?: string;
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

export function photoCountFor(unitInterval: number): number {
  if (unitInterval < 0.2) return 1;
  if (unitInterval < 0.75) return unitInterval < 0.475 ? 2 : 3;
  const t = (unitInterval - 0.75) / 0.25;
  if (t < 1 / 3) return 4;
  if (t < 2 / 3) return 5;
  return 6;
}

export function dimensionsFor(position: number): { width: number; height: number } {
  return position % 2 === 0 ? { width: 1200, height: 900 } : { width: 900, height: 1200 };
}
