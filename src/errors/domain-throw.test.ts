import { describe, expect, it } from "vitest";
import { AppErrors } from "./app-error.js";
import { DomainThrow, toAppError } from "./domain-throw.js";

describe("toAppError", () => {
  it("unwraps a DomainThrow back to its AppError", () => {
    const appError = AppErrors.conflict("request_already_answered", "already answered");
    const thrown = new DomainThrow(appError);
    expect(toAppError(thrown)).toBe(appError);
  });

  it("converts an arbitrary Error into internal_error, keeping it as cause", () => {
    const original = new Error("db exploded");
    const result = toAppError(original);
    expect(result.code).toBe("internal_error");
    expect(result.message).toBe("db exploded");
    if (result.code === "internal_error") {
      expect(result.cause).toBe(original);
    }
  });

  it("converts a non-Error throw into internal_error with a generic message", () => {
    const result = toAppError("some string throw");
    expect(result.code).toBe("internal_error");
    expect(result.message).toBe("Unexpected error");
  });
});
