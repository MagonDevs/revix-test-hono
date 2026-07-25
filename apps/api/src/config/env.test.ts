import { describe, expect, it } from "vitest";
import { parseEnv } from "./env.js";

const validBase = {
  DATABASE_URL: "postgres://user:pass@localhost:5432/db",
  AUTH_SECRET: "a".repeat(32),
  PUBLIC_ORIGIN: "http://localhost:3000",
};

describe("parseEnv", () => {
  it("applies defaults for optional fields", () => {
    const parsedEnv = parseEnv(validBase);
    expect(parsedEnv.NODE_ENV).toBe("development");
    expect(parsedEnv.PORT).toBe(8787);
    expect(parsedEnv.DATABASE_POOL_MAX).toBe(10);
    expect(parsedEnv.STORAGE_DRIVER).toBe("local");
    expect(parsedEnv.LOG_LEVEL).toBe("info");
  });

  it("coerces numeric fields from strings", () => {
    const parsedEnv = parseEnv({ ...validBase, PORT: "4000", DATABASE_POOL_MAX: "5" });
    expect(parsedEnv.PORT).toBe(4000);
    expect(parsedEnv.DATABASE_POOL_MAX).toBe(5);
  });

  it("throws a readable error on missing required fields", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL|AUTH_SECRET|PUBLIC_ORIGIN/);
  });

  it("throws when AUTH_SECRET is too short", () => {
    expect(() => parseEnv({ ...validBase, AUTH_SECRET: "short" })).toThrow();
  });

  it("throws when DATABASE_URL does not start with postgres", () => {
    expect(() => parseEnv({ ...validBase, DATABASE_URL: "mysql://x" })).toThrow();
  });

  it("throws when PUBLIC_ORIGIN is not a URL", () => {
    expect(() => parseEnv({ ...validBase, PUBLIC_ORIGIN: "not-a-url" })).toThrow();
  });
});
