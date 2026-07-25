import { describe, expect, it } from "vitest";
import { usersUpdateMeInputSchema } from "./user.schema.js";

// Contract §8.2 — strict schema, email not in the input at all (it's not
// updatable via this procedure), ≥1 field required.

describe("usersUpdateMeInputSchema", () => {
  it("rejects an email field as an unrecognised key (strict object)", () => {
    const result = usersUpdateMeInputSchema.safeParse({ email: "new@example.com" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty object (at least one field required)", () => {
    const result = usersUpdateMeInputSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("accepts a single valid field", () => {
    const result = usersUpdateMeInputSchema.safeParse({ city: "Barcelona" });
    expect(result.success).toBe(true);
  });

  it("accepts explicit null to clear an optional field", () => {
    const result = usersUpdateMeInputSchema.safeParse({ phone: null });
    expect(result.success).toBe(true);
  });
});
