import { describe, expect, it } from "vitest";
import { composeDescription } from "./descriptions.js";

describe("composeDescription", () => {
  it("always lands between 180 and 600 characters", () => {
    for (let i = 0; i < 40; i++) {
      const text = composeDescription("Nala", "Madrid", {
        opener: i,
        temperament: i + 1,
        practical: i + 2,
        closer: i + 3,
      });
      expect(text.length).toBeGreaterThanOrEqual(180);
      expect(text.length).toBeLessThanOrEqual(600);
    }
  });

  it("substitutes {name} and {city} in the opener", () => {
    const text = composeDescription("Bruno", "Bilbao", {
      opener: 0,
      temperament: 0,
      practical: 0,
      closer: 0,
    });
    expect(text).toContain("Bruno");
    expect(text).toContain("Bilbao");
    expect(text).not.toContain("{name}");
    expect(text).not.toContain("{city}");
  });
});
