import { describe, expect, it } from "vitest";
import { petSizeEnum, petStatusEnum, requestStatusEnum, sexEnum, speciesEnum } from "./enums.js";
import {
  ageGroupSchema,
  petSizeSchema,
  petSortSchema,
  petStatusSchema,
  requestRoleSchema,
  requestStatusSchema,
  sexSchema,
  speciesSchema,
} from "#contracts";

// Data model §2: "A contract test asserts speciesEnum.enumValues equals
// speciesSchema.options, for every enum." This is what makes drift
// between the database and the contract impossible. No live DB needed —
// pgEnum() carries its declared values statically.

describe("enum parity with @adopta/contracts", () => {
  it("species", () => {
    expect(speciesEnum.enumValues).toEqual(speciesSchema.options);
  });

  it("sex", () => {
    expect(sexEnum.enumValues).toEqual(sexSchema.options);
  });

  it("pet_size", () => {
    expect(petSizeEnum.enumValues).toEqual(petSizeSchema.options);
  });

  it("pet_status", () => {
    expect(petStatusEnum.enumValues).toEqual(petStatusSchema.options);
  });

  it("request_status", () => {
    expect(requestStatusEnum.enumValues).toEqual(requestStatusSchema.options);
  });

  // Not database enums (not modelled as pgEnum), listed so the intent to
  // exclude them is visible rather than accidental.
  it("ageGroup and petSort and requestRole are derived/query values, not db enums", () => {
    expect(ageGroupSchema.options.length).toBeGreaterThan(0);
    expect(petSortSchema.options.length).toBeGreaterThan(0);
    expect(requestRoleSchema.options.length).toBeGreaterThan(0);
  });
});
