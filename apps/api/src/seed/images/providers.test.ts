import { describe, expect, it } from "vitest";
import { avatarUrlFor, imageUrlFor, stableLock } from "./providers.js";

// Spec §5.2 exact URL shapes, verified live against each provider
// 2026-07-25 — see docs/notes/seed-images.md.

describe("stableLock", () => {
  it("is deterministic per (species, index)", () => {
    expect(stableLock("dog", 3)).toBe(stableLock("dog", 3));
  });

  it("differs across species and index", () => {
    expect(stableLock("dog", 3)).not.toBe(stableLock("cat", 3));
    expect(stableLock("dog", 3)).not.toBe(stableLock("dog", 4));
  });
});

describe("imageUrlFor", () => {
  it("builds the placedog.net shape for dogs", () => {
    const url = imageUrlFor("dog", 0, 1200, 900);
    expect(url).toMatch(/^https:\/\/placedog\.net\/1200\/900\?id=\d+$/);
  });

  it("builds the cataas.com shape for cats", () => {
    const url = imageUrlFor("cat", 0, 1200, 900);
    expect(url).toMatch(/^https:\/\/cataas\.com\/cat\?width=1200&height=900&seed=\d+$/);
  });

  it("builds the loremflickr.com shape for rabbits and birds", () => {
    expect(imageUrlFor("rabbit", 0, 900, 1200)).toMatch(
      /^https:\/\/loremflickr\.com\/900\/1200\/rabbit\/all\?lock=\d+$/,
    );
    expect(imageUrlFor("bird", 0, 900, 1200)).toMatch(
      /^https:\/\/loremflickr\.com\/900\/1200\/bird\/all\?lock=\d+$/,
    );
  });

  it("builds the picsum.photos shape for other", () => {
    const url = imageUrlFor("other", 0, 1200, 900);
    expect(url).toMatch(/^https:\/\/picsum\.photos\/seed\/adopta-\d+\/1200\/900$/);
  });

  it("is deterministic — same species+index always gets the same URL", () => {
    expect(imageUrlFor("dog", 7)).toBe(imageUrlFor("dog", 7));
  });
});

describe("avatarUrlFor", () => {
  it("builds the dicebear notionists shape", () => {
    expect(avatarUrlFor("user-123")).toBe(
      "https://api.dicebear.com/9.x/notionists/svg?seed=user-123",
    );
  });
});
