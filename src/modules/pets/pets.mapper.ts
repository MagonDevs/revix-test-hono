import { mapUserSummary } from "../users/index.js";
import type { OwnedPet, Pet, PetPhoto, RequestStatus } from "#contracts";
import type { UserRow } from "../users/index.js";

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

export interface PetPhotoRow {
  id: string;
  alt: string | null;
  position: number;
  uploadId: string;
  width: number;
  height: number;
}

export interface ViewerFlags {
  isFavourited: boolean;
  viewerRequestStatus: RequestStatus | null;
}

export function mapPetPhoto(row: PetPhotoRow): PetPhoto {
  return {
    id: row.id,
    url: `/api/v1/uploads/${row.uploadId}/raw`,
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
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
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
