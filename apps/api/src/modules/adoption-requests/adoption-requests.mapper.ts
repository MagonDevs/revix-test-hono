import { mapPetPhoto } from "../pets/index.js";
import { mapUserSummary } from "../users/index.js";
import type { PetPhotoRow } from "../pets/index.js";
import type { UserRow } from "../users/index.js";
import type { AdoptionRequest, Pet as PetContract } from "@adopta/contracts";

// Pure rows -> contract output mapper (architecture §2.1).

/** Shape of a row read from `adoption_requests`, joined with pet/adopter/guardian. */
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

/**
 * R-19 — `contact` holds the *counterparty's* email/phone, populated only
 * when `status === 'accepted'`, and only for the two parties. Driven purely
 * by the caller's id against the row's already-joined adopter/guardian
 * data — no extra query. Rows reach this mapper already scoped to the two
 * parties (repository visibility predicate), so a caller who is neither
 * simply never gets a row in the first place.
 */
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
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
  };
}
