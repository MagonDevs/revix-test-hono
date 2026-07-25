import { z } from "zod";

// §3 — Enums. Exact values; adding one is a contract change.

export const speciesSchema = z.enum(["dog", "cat", "rabbit", "bird", "other"]);
export type Species = z.infer<typeof speciesSchema>;

export const sexSchema = z.enum(["male", "female", "unknown"]);
export type Sex = z.infer<typeof sexSchema>;

export const petSizeSchema = z.enum(["small", "medium", "large"]);
export type PetSize = z.infer<typeof petSizeSchema>;

export const ageGroupSchema = z.enum(["baby", "young", "adult", "senior"]);
export type AgeGroup = z.infer<typeof ageGroupSchema>;

export const petStatusSchema = z.enum(["available", "reserved", "adopted", "withdrawn"]);
export type PetStatus = z.infer<typeof petStatusSchema>;

export const requestStatusSchema = z.enum(["pending", "accepted", "declined", "withdrawn"]);
export type RequestStatus = z.infer<typeof requestStatusSchema>;

export const petSortSchema = z.enum(["newest", "oldest", "name_asc"]);
export type PetSort = z.infer<typeof petSortSchema>;

export const requestRoleSchema = z.enum(["adopter", "guardian"]);
export type RequestRole = z.infer<typeof requestRoleSchema>;

// §3.1 — Age groups. `ageGroup` is derived from `ageMonths`, never stored,
// never accepted as pet input. Boundaries are inclusive on both ends.
export const AGE_GROUP_MONTHS = {
  baby: [0, 5],
  young: [6, 23],
  adult: [24, 95],
  senior: [96, 360],
} as const satisfies Record<AgeGroup, readonly [number, number]>;
