import { describe, expect, it } from "vitest";
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
import { petSizeEnum, petStatusEnum, requestStatusEnum, sexEnum, speciesEnum } from "./enums.js";

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

  it("ageGroup and petSort and requestRole are derived/query values, not db enums", () => {
    expect(ageGroupSchema.options.length).toBeGreaterThan(0);
    expect(petSortSchema.options.length).toBeGreaterThan(0);
    expect(requestRoleSchema.options.length).toBeGreaterThan(0);
  });
});
