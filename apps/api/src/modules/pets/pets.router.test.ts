import {
  petsByIdInputSchema,
  petsCreateInputSchema,
  petsListByOwnerInputSchema,
  petsListInputSchema,
  petsListMineInputSchema,
  petsListOutputSchema,
  petsRemoveInputSchema,
  petsSetStatusInputSchema,
  petsUpdateInputSchema,
  petSchema,
} from "@adopta/contracts";
import { describe, expect, it } from "vitest";

// Contract §8.3 — input/output schema shape checks for the four pets.*
// procedures wired in pets.router.ts. No DB required: this exercises
// the Zod schemas the router declares via `.input()`/`.output()`
// directly, plus a hand-built fake Pet against the output shape.

describe("petsListInputSchema", () => {
  it("applies defaults", () => {
    const parsed = petsListInputSchema.parse({});
    expect(parsed).toMatchObject({ sort: "newest", page: 1, perPage: 12 });
  });

  it("accepts a fully specified filter set", () => {
    const parsed = petsListInputSchema.parse({
      q: "labrador",
      species: ["dog", "cat"],
      size: ["small"],
      sex: "male",
      ageGroup: "adult",
      city: "Madrid",
      sort: "name_asc",
      page: 2,
      perPage: 24,
    });
    expect(parsed.species).toEqual(["dog", "cat"]);
  });

  it("rejects unknown keys (strict)", () => {
    expect(() => petsListInputSchema.parse({ bogus: true })).toThrow();
  });

  it("rejects an empty species array", () => {
    expect(() => petsListInputSchema.parse({ species: [] })).toThrow();
  });

  it("rejects perPage over the max", () => {
    expect(() => petsListInputSchema.parse({ perPage: 49 })).toThrow();
  });

  it("rejects q over the search max length", () => {
    expect(() => petsListInputSchema.parse({ q: "a".repeat(81) })).toThrow();
  });
});

describe("petsByIdInputSchema", () => {
  it("requires a uuid petId", () => {
    expect(() => petsByIdInputSchema.parse({ petId: "not-a-uuid" })).toThrow();
    expect(petsByIdInputSchema.parse({ petId: "0198f7b0-8e0e-7000-8000-000000000000" })).toEqual({
      petId: "0198f7b0-8e0e-7000-8000-000000000000",
    });
  });
});

describe("petsListByOwnerInputSchema", () => {
  it("applies pagination defaults, requires ownerId", () => {
    const parsed = petsListByOwnerInputSchema.parse({ ownerId: "user-1" });
    expect(parsed).toEqual({ ownerId: "user-1", page: 1, perPage: 12 });
    expect(() => petsListByOwnerInputSchema.parse({})).toThrow();
  });
});

describe("petsListMineInputSchema", () => {
  it("status is optional, sort defaults to newest", () => {
    const parsed = petsListMineInputSchema.parse({});
    expect(parsed).toMatchObject({ sort: "newest", page: 1, perPage: 12 });
    expect(parsed.status).toBeUndefined();
  });

  it("accepts an explicit status", () => {
    expect(petsListMineInputSchema.parse({ status: "withdrawn" }).status).toBe("withdrawn");
  });
});

describe("output schema shapes", () => {
  const fakePet = {
    id: "0198f7b0-8e0e-7000-8000-000000000000",
    name: "Rex",
    species: "dog",
    breed: "Labrador",
    sex: "male",
    ageMonths: 24,
    size: "medium",
    weightKg: 25.5,
    description: "A very good boy who loves long walks in the park every single morning.",
    photos: [
      {
        id: "0198f7b0-8e0e-7000-8000-000000000001",
        url: "/api/uploads/0198f7b0-8e0e-7000-8000-000000000002/raw",
        alt: null,
        width: 800,
        height: 600,
      },
    ],
    city: "Madrid",
    status: "available",
    isVaccinated: true,
    isNeutered: false,
    isGoodWithKids: true,
    isGoodWithPets: false,
    isFavourited: false,
    viewerRequestStatus: null,
    guardian: {
      id: "user-1",
      name: "Ana",
      city: "Madrid",
      avatarUrl: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    },
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-02T00:00:00Z"),
  };

  it("petSchema accepts a well-formed Pet", () => {
    expect(() => petSchema.parse(fakePet)).not.toThrow();
  });

  it("petsListOutputSchema accepts a paginated Pet page", () => {
    const page = {
      items: [fakePet],
      meta: { page: 1, perPage: 12, total: 1, totalPages: 1 },
    };
    expect(() => petsListOutputSchema.parse(page)).not.toThrow();
  });

  it("petSchema rejects a guardian carrying email (R-22)", () => {
    const withEmail = { ...fakePet, guardian: { ...fakePet.guardian, email: "leak@example.com" } };
    // userSummarySchema is not strict, so this doesn't throw — but the
    // parsed value must not surface the leaked field either way.
    const parsed = petSchema.parse(withEmail);
    expect(parsed.guardian).not.toHaveProperty("email");
  });
});

describe("petsCreateInputSchema (R-4)", () => {
  const validPhoto = { uploadId: "0198f7b0-8e0e-7000-8000-000000000000" };
  const base = {
    name: "Rex",
    species: "dog",
    sex: "male",
    ageMonths: 12,
    size: "medium",
    description: "A very good boy who loves long walks and belly rubs every single day.",
    city: "Madrid",
    photos: [validPhoto],
  };

  it("accepts a well-formed create input", () => {
    expect(() => petsCreateInputSchema.parse(base)).not.toThrow();
  });

  it("has no status field to accept (R-4 — status is always 'available')", () => {
    expect("status" in petsCreateInputSchema.shape).toBe(false);
  });

  it("rejects a status key on the wire (strict schema)", () => {
    expect(() => petsCreateInputSchema.parse({ ...base, status: "adopted" })).toThrow();
  });

  it("requires at least one photo", () => {
    expect(() => petsCreateInputSchema.parse({ ...base, photos: [] })).toThrow();
  });
});

describe("petsUpdateInputSchema (R-16)", () => {
  const petId = "0198f7b0-8e0e-7000-8000-000000000000";

  it("accepts a partial patch", () => {
    expect(() => petsUpdateInputSchema.parse({ petId, name: "New name" })).not.toThrow();
  });

  it("has no status field (setStatus is the only way to change status)", () => {
    expect(() => petsUpdateInputSchema.parse({ petId, status: "adopted" })).toThrow();
  });

  it("accepts a full photos array, which replaces the whole ordered set", () => {
    const parsed = petsUpdateInputSchema.parse({
      petId,
      photos: [{ uploadId: petId }, { uploadId: "0198f7b0-8e0e-7000-8000-000000000001" }],
    });
    expect(parsed.photos).toHaveLength(2);
  });
});

describe("petsSetStatusInputSchema (R-5)", () => {
  it("defaults declinePendingRequests to true (R-6)", () => {
    const parsed = petsSetStatusInputSchema.parse({
      petId: "0198f7b0-8e0e-7000-8000-000000000000",
      status: "adopted",
    });
    expect(parsed.declinePendingRequests).toBe(true);
  });
});

describe("petsRemoveInputSchema", () => {
  it("requires a uuid petId", () => {
    expect(() => petsRemoveInputSchema.parse({ petId: "not-a-uuid" })).toThrow();
  });
});
