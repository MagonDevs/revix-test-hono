import { pgEnum } from "drizzle-orm/pg-core";

export const speciesEnum = pgEnum("species", ["dog", "cat", "rabbit", "bird", "other"]);
export const sexEnum = pgEnum("sex", ["male", "female", "unknown"]);
export const petSizeEnum = pgEnum("pet_size", ["small", "medium", "large"]);
export const petStatusEnum = pgEnum("pet_status", [
  "available",
  "reserved",
  "adopted",
  "withdrawn",
]);
export const requestStatusEnum = pgEnum("request_status", [
  "pending",
  "accepted",
  "declined",
  "withdrawn",
]);
