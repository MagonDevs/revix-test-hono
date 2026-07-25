import { TRPCError } from "@trpc/server";
import { err, ok } from "neverthrow";
import { describe, expect, it } from "vitest";
import { AppErrors } from "../errors/app-error.js";
import { AppErrorCause, DomainThrow, appErrorToTRPCError, toAppError, unwrap } from "./unwrap.js";

describe("unwrap", () => {
  it("passes an Ok value through unchanged", () => {
    expect(unwrap(ok({ id: "abc" }))).toEqual({ id: "abc" });
  });

  it("throws a TRPCError for an Err, preserving the AppError as cause", () => {
    const appError = AppErrors.notFound("Pet");
    expect(() => unwrap(err(appError))).toThrowError(TRPCError);
    try {
      unwrap(err(appError));
      expect.unreachable();
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(TRPCError);
      const trpcError = thrown as TRPCError;
      expect(trpcError.code).toBe("NOT_FOUND");
      expect(trpcError.cause).toBeInstanceOf(AppErrorCause);
      expect((trpcError.cause as AppErrorCause).appError).toBe(appError);
    }
  });
});

describe("appErrorToTRPCError — tRPC code mapping (contract §5.1)", () => {
  it("validation_error -> BAD_REQUEST", () => {
    expect(appErrorToTRPCError(AppErrors.invalidField("name", "required")).code).toBe(
      "BAD_REQUEST",
    );
  });
  it("unauthenticated -> UNAUTHORIZED", () => {
    expect(appErrorToTRPCError(AppErrors.unauthenticated()).code).toBe("UNAUTHORIZED");
  });
  it("forbidden -> FORBIDDEN", () => {
    expect(appErrorToTRPCError(AppErrors.forbidden()).code).toBe("FORBIDDEN");
  });
  it("not_found -> NOT_FOUND", () => {
    expect(appErrorToTRPCError(AppErrors.notFound("Pet")).code).toBe("NOT_FOUND");
  });
  it("conflict -> CONFLICT", () => {
    expect(appErrorToTRPCError(AppErrors.conflict("duplicate_email", "dup")).code).toBe("CONFLICT");
  });
  it("rate_limited -> TOO_MANY_REQUESTS", () => {
    expect(appErrorToTRPCError(AppErrors.rateLimited(30)).code).toBe("TOO_MANY_REQUESTS");
  });
  it("internal_error -> INTERNAL_SERVER_ERROR", () => {
    expect(appErrorToTRPCError(AppErrors.internal("boom")).code).toBe("INTERNAL_SERVER_ERROR");
  });
});

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
