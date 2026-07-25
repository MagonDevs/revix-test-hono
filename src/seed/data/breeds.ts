import { at } from "../util.js";
import type { Species } from "#contracts";

// Spec §3 — curated per-species breeds. Also backs `meta.breeds`
// (src/trpc/router.ts), replacing the B2/B3 four-entry stub.
// `pet.breed` still accepts any free-text string within LIMITS.pet.breedMax
// — this list is a suggestion source, not an enum.

export const BREEDS_BY_SPECIES: Record<Species, string[]> = {
  dog: [
    "Labrador Retriever",
    "German Shepherd",
    "Poodle",
    "Bulldog",
    "Golden Retriever",
    "Beagle",
    "Podenco",
    "Galgo Español",
    "Border Collie",
    "Chihuahua",
    "Cocker Spaniel",
    "Mastín Español",
    "Schnauzer",
    "Mixed Breed",
  ],
  cat: [
    "Domestic Shorthair",
    "Siamese",
    "Maine Coon",
    "Common European",
    "British Shorthair",
    "Persian",
    "Ragdoll",
    "Sphynx",
    "Bengal",
    "Mixed Breed",
  ],
  rabbit: [
    "Holland Lop",
    "Netherland Dwarf",
    "Rex",
    "Lionhead",
    "Mini Lop",
    "Dutch",
    "Mixed Breed",
  ],
  bird: [
    "Budgerigar",
    "Cockatiel",
    "Canary",
    "Lovebird",
    "African Grey",
    "Zebra Finch",
    "Mixed Breed",
  ],
  other: ["Guinea Pig", "Hamster", "Ferret", "Tortoise", "Mixed Breed"],
};

export function breedFor(species: Species, index: number): string {
  const list = BREEDS_BY_SPECIES[species];
  return at(list, index % list.length, "breed list");
}
