import { describe, expect, it } from "vitest";
import { mapOwnedPet, mapPet, mapPetPhoto } from "./pets.mapper.js";
import type { PetPhotoRow, PetRow, ViewerFlags } from "./pets.mapper.js";

// Contract §6.4-6.6 — pure rows -> Pet/PetPhoto/OwnedPet mappers. No I/O,
// no Docker required.

const guardian: PetRow["guardian"] = {
  id: "user-1",
  name: "Ana",
  email: "ana@example.com",
  image: null,
  city: "Madrid",
  phone: "+34600000000",
  bio: "Loves dogs",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const row: PetRow = {
  id: "pet-1",
  name: "Rex",
  species: "dog",
  breed: "Labrador",
  sex: "male",
  ageMonths: 24,
  size: "medium",
  weightGrams: 25500,
  description: "A very good boy who loves long walks and belly rubs in the park every morning.",
  city: "Madrid",
  status: "available",
  isVaccinated: true,
  isNeutered: false,
  isGoodWithKids: true,
  isGoodWithPets: false,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-02T00:00:00Z"),
  guardian,
};

const photoRow: PetPhotoRow = {
  id: "photo-1",
  alt: "Rex sitting",
  position: 0,
  uploadId: "upload-1",
  width: 800,
  height: 600,
};

const anonFlags: ViewerFlags = { isFavourited: false, viewerRequestStatus: null };

describe("mapPetPhoto", () => {
  it("builds the raw-upload url and preserves order-relevant fields", () => {
    expect(mapPetPhoto(photoRow)).toEqual({
      id: "photo-1",
      url: "/api/uploads/upload-1/raw",
      alt: "Rex sitting",
      width: 800,
      height: 600,
    });
  });

  it("nulls out alt when absent", () => {
    expect(mapPetPhoto({ ...photoRow, alt: null }).alt).toBeNull();
  });
});

describe("mapPet", () => {
  it("converts weightGrams to weightKg", () => {
    expect(mapPet(row, [], anonFlags).weightKg).toBe(25.5);
  });

  it("maps null weightGrams to null weightKg", () => {
    expect(mapPet({ ...row, weightGrams: null }, [], anonFlags).weightKg).toBeNull();
  });

  it("embeds the guardian as a UserSummary — never email/phone", () => {
    const pet = mapPet(row, [], anonFlags);
    expect(pet.guardian).toEqual({
      id: "user-1",
      name: "Ana",
      city: "Madrid",
      avatarUrl: null,
      createdAt: guardian.createdAt,
    });
    expect(pet.guardian).not.toHaveProperty("email");
    expect(pet.guardian).not.toHaveProperty("phone");
  });

  it("returns photos in position order, unmodified", () => {
    const second: PetPhotoRow = { ...photoRow, id: "photo-2", position: 1 };
    const pet = mapPet(row, [photoRow, second], anonFlags);
    expect(pet.photos.map((p) => p.id)).toEqual(["photo-1", "photo-2"]);
  });

  it("carries viewer flags through untouched (R-20)", () => {
    const flags: ViewerFlags = { isFavourited: true, viewerRequestStatus: "pending" };
    const pet = mapPet(row, [], flags);
    expect(pet.isFavourited).toBe(true);
    expect(pet.viewerRequestStatus).toBe("pending");
  });

  it("anonymous callers always get false/null", () => {
    const pet = mapPet(row, [], anonFlags);
    expect(pet.isFavourited).toBe(false);
    expect(pet.viewerRequestStatus).toBeNull();
  });
});

describe("mapOwnedPet", () => {
  it("extends Pet with pendingRequestCount", () => {
    const owned = mapOwnedPet(row, [photoRow], anonFlags, 3);
    expect(owned.pendingRequestCount).toBe(3);
    expect(owned.id).toBe("pet-1");
    expect(owned.photos).toHaveLength(1);
  });
});
