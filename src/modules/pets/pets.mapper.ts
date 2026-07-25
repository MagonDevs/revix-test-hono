import { mapUserSummary } from "../users/index.js";
import type { OwnedPet, Pet, PetPhoto, RequestStatus } from "#contracts";
import type { UserRow } from "../users/index.js";

// Pure rows -> contract output mappers (architecture §2.1: mapper may
// import contracts, must not do I/O).

/** Shape of a row read from `pets`, joined with its guardian's user row. */
export interface PetRow {
  id: string;
  name: string;
  species: Pet["species"];
  breed: string | null;
  sex: Pet["sex"];
  ageMonths: number;
  size: Pet["size"];
  weightGrams: number | null;
  description: string;
  city: string;
  status: Pet["status"];
  isVaccinated: boolean;
  isNeutered: boolean;
  isGoodWithKids: boolean;
  isGoodWithPets: boolean;
  createdAt: Date;
  updatedAt: Date;
  guardian: UserRow;
}

/** Shape of a row read from `pet_photos` joined with its `uploads` row. */
export interface PetPhotoRow {
  id: string;
  alt: string | null;
  position: number;
  uploadId: string;
  width: number;
  height: number;
}

/** Per-caller fields computed in the repository query (R-20). */
export interface ViewerFlags {
  isFavourited: boolean;
  viewerRequestStatus: RequestStatus | null;
}

export function mapPetPhoto(row: PetPhotoRow): PetPhoto {
  return {
    id: row.id,
    url: `/api/uploads/${row.uploadId}/raw`,
    alt: row.alt ?? null,
    width: row.width,
    height: row.height,
  };
}

export function mapPet(row: PetRow, photos: PetPhotoRow[], viewerFlags: ViewerFlags): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed ?? null,
    sex: row.sex,
    ageMonths: row.ageMonths,
    size: row.size,
    // Defensive rounding: the contract validates weightKg to one decimal
    // place on input (`.multipleOf(0.1)`), but nothing enforces that on
    // the stored gram value. Round here so a stray non-multiple-of-100
    // gram value in the DB can never produce a contract-violating
    // response (e.g. a client that round-trips a fetched pet back
    // through pets.update would fail validation on a field it never
    // touched).
    weightKg: row.weightGrams !== null ? Math.round(row.weightGrams / 100) / 10 : null,
    description: row.description,
    photos: photos.map(mapPetPhoto),
    city: row.city,
    status: row.status,
    isVaccinated: row.isVaccinated,
    isNeutered: row.isNeutered,
    isGoodWithKids: row.isGoodWithKids,
    isGoodWithPets: row.isGoodWithPets,
    isFavourited: viewerFlags.isFavourited,
    viewerRequestStatus: viewerFlags.viewerRequestStatus,
    guardian: mapUserSummary(row.guardian),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapOwnedPet(
  row: PetRow,
  photos: PetPhotoRow[],
  viewerFlags: ViewerFlags,
  pendingRequestCount: number,
): OwnedPet {
  return {
    ...mapPet(row, photos, viewerFlags),
    pendingRequestCount,
  };
}
