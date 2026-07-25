import { mapPetPhoto } from "../pets/index.js";
import { mapUserSummary } from "../users/index.js";
import type { AdoptionRequest, Pet as PetContract } from "#contracts";
import type { PetPhotoRow } from "../pets/index.js";
import type { UserRow } from "../users/index.js";

export interface AdoptionRequestRow {
  id: string;
  status: AdoptionRequest["status"];
  message: string;
  createdAt: Date;
  respondedAt: Date | null;
  pet: {
    id: string;
    name: string;
    status: PetContract["status"];
  };
  adopter: UserRow;
  guardian: UserRow;
}

export function mapAdoptionRequest(
  row: AdoptionRequestRow,
  coverPhoto: PetPhotoRow | null,
  callerId: string,
): AdoptionRequest {
  const contact =
    row.status === "accepted"
      ? callerId === row.adopter.id
        ? { email: row.guardian.email, phone: row.guardian.phone ?? null }
        : callerId === row.guardian.id
          ? { email: row.adopter.email, phone: row.adopter.phone ?? null }
          : null
      : null;

  return {
    id: row.id,
    status: row.status,
    message: row.message,
    pet: {
      id: row.pet.id,
      name: row.pet.name,
      status: row.pet.status,
      coverPhoto: coverPhoto ? mapPetPhoto(coverPhoto) : null,
    },
    adopter: mapUserSummary(row.adopter),
    guardian: mapUserSummary(row.guardian),
    contact,
    createdAt: row.createdAt.toISOString(),
    respondedAt: row.respondedAt?.toISOString() ?? null,
  };
}
