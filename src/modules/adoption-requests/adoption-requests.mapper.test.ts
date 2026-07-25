import { describe, expect, it } from "vitest";
import { mapAdoptionRequest } from "./adoption-requests.mapper.js";
import type { AdoptionRequestRow } from "./adoption-requests.mapper.js";
import type { PetPhotoRow } from "../pets/index.js";

// Contract §6.7 — pure rows -> AdoptionRequest mapper. No I/O, no Docker
// required. R-19 is the star: `contact` is populated only on `accepted`,
// only for the two parties, and holds the *counterparty's* details.

const adopter: AdoptionRequestRow["adopter"] = {
  id: "adopter-1",
  name: "Bea",
  email: "bea@example.com",
  image: null,
  city: "Madrid",
  phone: "+34600000001",
  bio: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

const guardian: AdoptionRequestRow["guardian"] = {
  id: "guardian-1",
  name: "Ana",
  email: "ana@example.com",
  image: null,
  city: "Madrid",
  phone: "+34600000002",
  bio: "Loves dogs",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

function makeRow(overrides: Partial<AdoptionRequestRow> = {}): AdoptionRequestRow {
  return {
    id: "req-1",
    status: "pending",
    message: "Hello, we'd love to meet Rex this week if possible, please let us know.",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    respondedAt: null,
    pet: { id: "pet-1", name: "Rex", status: "available" },
    adopter,
    guardian,
    ...overrides,
  };
}

const photo: PetPhotoRow = {
  id: "photo-1",
  alt: "Rex sitting",
  position: 0,
  uploadId: "upload-1",
  width: 800,
  height: 600,
};

describe("mapAdoptionRequest", () => {
  it("R-19: contact is null while status is pending, for either party", () => {
    const row = makeRow({ status: "pending" });
    expect(mapAdoptionRequest(row, null, adopter.id).contact).toBeNull();
    expect(mapAdoptionRequest(row, null, guardian.id).contact).toBeNull();
  });

  it("R-19: contact is null for declined/withdrawn even for the two parties", () => {
    const declined = makeRow({ status: "declined", respondedAt: new Date() });
    expect(mapAdoptionRequest(declined, null, adopter.id).contact).toBeNull();
    const withdrawn = makeRow({ status: "withdrawn", respondedAt: new Date() });
    expect(mapAdoptionRequest(withdrawn, null, adopter.id).contact).toBeNull();
  });

  it("R-19: when accepted, the adopter sees the guardian's contact", () => {
    const row = makeRow({ status: "accepted", respondedAt: new Date() });
    const result = mapAdoptionRequest(row, null, adopter.id);
    expect(result.contact).toEqual({ email: guardian.email, phone: guardian.phone });
  });

  it("R-19: when accepted, the guardian sees the adopter's contact", () => {
    const row = makeRow({ status: "accepted", respondedAt: new Date() });
    const result = mapAdoptionRequest(row, null, guardian.id);
    expect(result.contact).toEqual({ email: adopter.email, phone: adopter.phone });
  });

  it("R-19: a caller who is neither party gets a null contact (defence in depth)", () => {
    const row = makeRow({ status: "accepted", respondedAt: new Date() });
    expect(mapAdoptionRequest(row, null, "stranger-1").contact).toBeNull();
  });

  it("R-22: adopter/guardian summaries never leak email/phone outside contact", () => {
    const row = makeRow({ status: "accepted", respondedAt: new Date() });
    const result = mapAdoptionRequest(row, null, adopter.id);
    expect(result.adopter).not.toHaveProperty("email");
    expect(result.adopter).not.toHaveProperty("phone");
    expect(result.guardian).not.toHaveProperty("email");
    expect(result.guardian).not.toHaveProperty("phone");
  });

  it("embeds the pet's cover photo (position 0) when present, null when absent", () => {
    const row = makeRow();
    expect(mapAdoptionRequest(row, photo, adopter.id).pet.coverPhoto).toEqual({
      id: "photo-1",
      url: "/api/v1/uploads/upload-1/raw",
      alt: "Rex sitting",
      width: 800,
      height: 600,
    });
    expect(mapAdoptionRequest(row, null, adopter.id).pet.coverPhoto).toBeNull();
  });

  it("carries id/status/message/timestamps through untouched", () => {
    const respondedAt = new Date("2026-01-05T00:00:00Z");
    const row = makeRow({ status: "accepted", respondedAt });
    const result = mapAdoptionRequest(row, null, adopter.id);
    expect(result.id).toBe("req-1");
    expect(result.status).toBe("accepted");
    expect(result.respondedAt).toEqual(respondedAt.toISOString());
    expect(result.pet).toMatchObject({ id: "pet-1", name: "Rex", status: "available" });
  });
});
