import type { Species } from "#contracts";

// Curated per-species suggestion list for a free-text combobox (contract
// §8.6). Not authoritative — `pet.breed` accepts any string within its
// length limit. Backs both `GET /meta/breeds` and the seeder's
// pet factory, so seeded pets and this endpoint never drift apart (B4).
// Previously lived under `src/seed/data/breeds.ts`; moved here because
// production request-handling code (`meta.breeds`) must not depend on the
// seeder (architecture §2.1).

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
