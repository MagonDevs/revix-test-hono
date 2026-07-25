import { describe, expect, it } from "vitest";
import { mapSessionUser, mapUserProfile, mapUserSummary } from "./users.mapper.js";
import type { UserRow } from "./users.mapper.js";

// R-22 — email/phone appear only on SessionUser, never on
// UserSummary/UserProfile.

const row: UserRow = {
  id: "user-1",
  name: "Ana",
  email: "ana@example.com",
  image: null,
  city: "Madrid",
  phone: "+34600000000",
  bio: "Loves dogs",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("mapUserSummary", () => {
  it("never includes email or phone", () => {
    const summary = mapUserSummary(row);
    expect(summary).not.toHaveProperty("email");
    expect(summary).not.toHaveProperty("phone");
    expect(summary).toEqual({
      id: "user-1",
      name: "Ana",
      city: "Madrid",
      avatarUrl: null,
      createdAt: row.createdAt.toISOString(),
    });
  });
});

describe("mapUserProfile", () => {
  it("never includes email or phone", () => {
    const profile = mapUserProfile(row, 3);
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("phone");
    expect(profile).toMatchObject({ bio: "Loves dogs", availablePetCount: 3 });
  });
});

describe("mapSessionUser", () => {
  it("is the only mapper that includes email and phone", () => {
    const sessionUser = mapSessionUser(row, 3);
    expect(sessionUser).toMatchObject({
      email: "ana@example.com",
      phone: "+34600000000",
    });
  });
});
