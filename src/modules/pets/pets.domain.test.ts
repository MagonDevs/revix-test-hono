import { describe, expect, it } from "vitest";
import { ageGroupRange, isLegalTransition, PUBLIC_LIST_STATUSES } from "./pets.domain.js";
import type { PetStatus } from "#contracts";

// Contract §3.1 age group boundaries, §8.3 pets.setStatus transition
// matrix (rule R-5), §8.3 pets.list status filter (rule R-1). Pure, no
// I/O — no Docker required.

describe("ageGroupRange", () => {
  it.each([
    ["baby", [0, 5]],
    ["young", [6, 23]],
    ["adult", [24, 95]],
    ["senior", [96, 360]],
  ] as const)("%s -> %j", (group, expected) => {
    expect(ageGroupRange(group)).toEqual(expected);
  });
});

describe("isLegalTransition", () => {
  const LEGAL: Array<[PetStatus, PetStatus]> = [
    ["available", "reserved"],
    ["available", "adopted"],
    ["available", "withdrawn"],
    ["reserved", "available"],
    ["reserved", "adopted"],
    ["reserved", "withdrawn"],
    ["adopted", "withdrawn"],
    ["withdrawn", "available"],
  ];

  const ILLEGAL: Array<[PetStatus, PetStatus]> = [
    ["available", "available"],
    ["adopted", "available"],
    ["adopted", "reserved"],
    ["adopted", "adopted"],
    ["withdrawn", "reserved"],
    ["withdrawn", "adopted"],
    ["withdrawn", "withdrawn"],
  ];

  it.each(LEGAL)("%s -> %s is legal", (from, to) => {
    expect(isLegalTransition(from, to)).toBe(true);
  });

  it.each(ILLEGAL)("%s -> %s is illegal", (from, to) => {
    expect(isLegalTransition(from, to)).toBe(false);
  });
});

describe("PUBLIC_LIST_STATUSES", () => {
  it("is exactly available and reserved (R-1)", () => {
    expect(PUBLIC_LIST_STATUSES).toEqual(["available", "reserved"]);
  });
});
