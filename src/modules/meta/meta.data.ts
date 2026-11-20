import { speciesSchema, type Species } from "#contracts";

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

const SPECIES_LABELS: Record<Species, string> = {
  dog: "Dog",
  cat: "Cat",
  rabbit: "Rabbit",
  bird: "Bird",
  other: "Other",
};

export const SPECIES_CATALOGUE = speciesSchema.options.map((value) => ({
  value,
  label: SPECIES_LABELS[value],
}));
