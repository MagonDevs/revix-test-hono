import { describe, expect, it } from "vitest";
import { normaliseBetterAuthError } from "./auth-error.js";

// Contract §5.4/§7.1-7.2, R-21 — pure unit tests of the rewrite function,
// no DB/Docker required. The function answers with an `AppError`; the HTTP
// status and wire body are `http/lib/http-error.ts`'s job, tested there.

describe("normaliseBetterAuthError", () => {
  it("rewrites a sign-up duplicate email into a duplicate_email conflict", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-up/email",
      status: 422,
      body: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists." },
    });

    expect(result).toMatchObject({ code: "conflict", reason: "duplicate_email" });
  });

  it("rewrites wrong-password sign-in into a generic unauthenticated error", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
    });

    expect(result.code).toBe("unauthenticated");
  });

  it("R-21: wrong-email and wrong-password sign-in produce an identical error", () => {
    const wrongEmail = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "User not found" },
    });
    const wrongPassword = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
    });

    expect(wrongEmail).toEqual(wrongPassword);
  });

  it("classifies an unrecognised failure as internal_error", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-up/email",
      status: 500,
      body: { code: "SOME_INTERNAL_THING", message: "db connection refused at 10.0.0.5:5432" },
    });

    expect(result.code).toBe("internal_error");
    // The raw driver detail must not survive into the AppError's message —
    // `toHttpErrorBody` also replaces an internal_error message wholesale,
    // so this is belt-and-braces on the same rule (architecture §4).
    expect(JSON.stringify(result)).not.toMatch(/10\.0\.0\.5/);
  });
});
