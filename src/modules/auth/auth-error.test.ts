import { describe, expect, it } from "vitest";
import { normaliseBetterAuthError } from "./auth-error.js";

// Contract §5.4/§7.1-7.2, R-21 — pure unit tests of the rewrite function,
// no DB/Docker required.

describe("normaliseBetterAuthError", () => {
  it("rewrites a sign-up duplicate email into the conflict shape", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-up/email",
      status: 422,
      body: { code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", message: "User already exists." },
      requestId: "req-1",
    });

    expect(result.status).toBe(409);
    expect(result.body.error.data).toMatchObject({
      appCode: "conflict",
      conflictReason: "duplicate_email",
      requestId: "req-1",
    });
    const fieldErrors = result.body.error.data.fieldErrors ?? [];
    expect(fieldErrors).toHaveLength(1);
    expect(fieldErrors[0]?.field).toBe("email");
  });

  it("rewrites wrong-password sign-in into a generic unauthenticated error", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
      requestId: "req-2",
    });

    expect(result.status).toBe(401);
    expect(result.body.error.data).toMatchObject({
      appCode: "unauthenticated",
      requestId: "req-2",
    });
  });

  it("R-21: wrong-email and wrong-password sign-in produce an identical message", () => {
    const wrongEmail = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "User not found" },
      requestId: "req-3",
    });
    const wrongPassword = normaliseBetterAuthError({
      path: "/api/auth/sign-in/email",
      status: 401,
      body: { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid password" },
      requestId: "req-3",
    });

    expect(wrongEmail.body.error.message).toBe(wrongPassword.body.error.message);
    expect(wrongEmail.body.error.data).toEqual(wrongPassword.body.error.data);
  });

  it("never leaks Better Auth's raw message/code for an unrecognised failure", () => {
    const result = normaliseBetterAuthError({
      path: "/api/auth/sign-up/email",
      status: 500,
      body: { code: "SOME_INTERNAL_THING", message: "db connection refused at 10.0.0.5:5432" },
      requestId: "req-4",
    });

    expect(result.status).toBe(500);
    expect(result.body.error.data).toEqual({ appCode: "internal_error", requestId: "req-4" });
    expect(JSON.stringify(result.body)).not.toMatch(/10\.0\.0\.5/);
  });
});
