import { describe, expect, it } from "vitest";
import {
  AGE_GROUP_MONTHS,
  LIMITS,
  createPetRequestSchema,
  paginatedSchema,
  petSchema,
  petsListQuerySchema,
  registerRequestSchema,
  sessionUserSchema,
  speciesSchema,
} from "./index.js";

describe("enums", () => {
  it("exposes the exact species set", () => {
    expect(speciesSchema.options).toEqual(["dog", "cat", "rabbit", "bird", "other"]);
  });

  it("has an age group range for every ageGroup option", () => {
    for (const key of Object.keys(AGE_GROUP_MONTHS)) {
      const [lo, hi] = AGE_GROUP_MONTHS[key as keyof typeof AGE_GROUP_MONTHS];
      expect(lo).toBeLessThanOrEqual(hi);
    }
  });
});

describe("constraints", () => {
  it("pet.photosMin/Max match the contract", () => {
    expect(LIMITS.pet.photosMin).toBe(1);
    expect(LIMITS.pet.photosMax).toBe(6);
  });
});

describe("pagination", () => {
  it("paginatedSchema wraps items + meta", () => {
    const schema = paginatedSchema(petSchema);
    const result = schema.safeParse({
      items: [],
      meta: { page: 1, perPage: 12, total: 0, totalPages: 0 },
    });
    expect(result.success).toBe(true);
  });
});

describe("GET /pets query", () => {
  it("applies defaults for sort/page/perPage", () => {
    const parsed = petsListQuerySchema.parse({});
    expect(parsed).toMatchObject({ sort: "newest", page: 1, perPage: LIMITS.list.perPageDefault });
  });

  it("coerces the numeric params from their string form", () => {
    const parsed = petsListQuerySchema.parse({ page: "3", perPage: "24" });
    expect(parsed).toMatchObject({ page: 3, perPage: 24 });
  });

  it("accepts a repeated filter as both a bare value and an array", () => {
    expect(petsListQuerySchema.parse({ species: "dog" }).species).toEqual(["dog"]);
    expect(petsListQuerySchema.parse({ species: ["dog", "cat"] }).species).toEqual(["dog", "cat"]);
  });

  it("ignores unknown query params rather than rejecting the request", () => {
    const result = petsListQuerySchema.safeParse({ bogus: "true" });
    expect(result.success).toBe(true);
  });
});

describe("POST /pets body", () => {
  it("rejects a description under the minimum length", () => {
    const result = createPetRequestSchema.safeParse({
      name: "Rex",
      species: "dog",
      sex: "male",
      ageMonths: 12,
      size: "medium",
      description: "too short",
      city: "Barcelona",
      photos: [{ uploadId: "0000018f-0000-7000-8000-000000000000" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown keys (strict body)", () => {
    const result = createPetRequestSchema.safeParse({ bogus: true });
    expect(result.success).toBe(false);
  });
});

describe("POST /auth/register body", () => {
  it("requires city", () => {
    const result = registerRequestSchema.safeParse({
      name: "Marta Ruiz",
      email: "marta@example.com",
      password: "correct-horse",
    });
    expect(result.success).toBe(false);
  });
});

describe("sessionUserSchema", () => {
  it("carries email and phone, unlike UserSummary", () => {
    expect(sessionUserSchema.shape.email).toBeDefined();
    expect(sessionUserSchema.shape.phone).toBeDefined();
  });
});
