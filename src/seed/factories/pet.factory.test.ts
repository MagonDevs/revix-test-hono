import { describe, expect, it } from "vitest";
import { dimensionsFor, photoCountFor } from "./pet.factory.js";

describe("photoCountFor", () => {
  it("returns counts in [1, 6]", () => {
    for (let i = 0; i < 1000; i++) {
      const count = photoCountFor(i / 1000);
      expect(count).toBeGreaterThanOrEqual(1);
      expect(count).toBeLessThanOrEqual(6);
    }
  });

  it("matches the 20% / 55% / 25% split within the input's own buckets", () => {
    const SAMPLES = 10_000;
    const buckets = { one: 0, twoThree: 0, fourToSix: 0 };
    for (let i = 0; i < SAMPLES; i++) {
      const count = photoCountFor(i / SAMPLES);
      if (count === 1) buckets.one++;
      else if (count === 2 || count === 3) buckets.twoThree++;
      else buckets.fourToSix++;
    }
    expect(buckets.one / SAMPLES).toBeCloseTo(0.2, 1);
    expect(buckets.twoThree / SAMPLES).toBeCloseTo(0.55, 1);
    expect(buckets.fourToSix / SAMPLES).toBeCloseTo(0.25, 1);
  });

  it("is a pure function of its input", () => {
    expect(photoCountFor(0.42)).toBe(photoCountFor(0.42));
  });
});

describe("dimensionsFor", () => {
  it("alternates landscape/portrait by position", () => {
    expect(dimensionsFor(0)).toEqual({ width: 1200, height: 900 });
    expect(dimensionsFor(1)).toEqual({ width: 900, height: 1200 });
    expect(dimensionsFor(2)).toEqual({ width: 1200, height: 900 });
    expect(dimensionsFor(3)).toEqual({ width: 900, height: 1200 });
  });
});
