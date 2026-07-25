import type { ErrorData } from "@adopta/contracts";

// Architecture §5.4 / contract §7.1-7.2 — Better Auth's native error
// responses must be rewritten into the standard AppError wire shape
// before reaching the client. This module is the pure rewrite function;
// `http/routes/auth.route.ts` is the thin HTTP wrapper that calls it.
//
// Verified against the installed better-auth@1.6.25 source
// (dist/api/routes/sign-up.mjs, dist/api/routes/sign-in.mjs):
//   - duplicate email on sign-up -> 422 UNPROCESSABLE_ENTITY,
//     code "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL"
//   - wrong email OR wrong password on sign-in -> 401 UNAUTHORIZED,
//     code "INVALID_EMAIL_OR_PASSWORD" in every branch (this is what
//     makes R-21 — "sign-in never reveals whether the email exists" —
//     hold: Better Auth itself never distinguishes the two cases).
// Matching is done primarily on `body.code`, with a status+message
// fallback in case a future Better Auth version changes the code string
// without changing the observable behaviour.

export interface BetterAuthErrorInput {
  /** Request path, e.g. "/api/auth/sign-up/email". */
  path: string;
  status: number;
  /** Parsed JSON body from Better Auth's response, or null if unparsable. */
  body: unknown;
  requestId: string;
}

export interface NormalisedAuthError {
  status: number;
  body: { error: { message: string; data: ErrorData } };
}

function bodyCode(body: unknown): string | undefined {
  if (typeof body === "object" && body !== null && "code" in body) {
    const code = body.code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function bodyMessage(body: unknown): string {
  if (typeof body === "object" && body !== null && "message" in body) {
    const message = body.message;
    if (typeof message === "string") return message;
  }
  return "Request failed";
}

function isDuplicateEmail(status: number, body: unknown): boolean {
  const code = bodyCode(body);
  if (code)
    return code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || code === "USER_ALREADY_EXISTS";
  return status === 422 && /already exists/i.test(bodyMessage(body));
}

function isBadCredentials(status: number, body: unknown): boolean {
  const code = bodyCode(body);
  if (code) {
    return (
      code === "INVALID_EMAIL_OR_PASSWORD" ||
      code === "INVALID_PASSWORD" ||
      code === "USER_NOT_FOUND"
    );
  }
  return status === 401 && /invalid|not found/i.test(bodyMessage(body));
}

/**
 * Rewrites a non-2xx response from `auth.handler()` into the contract's
 * error shape. Callers should only invoke this for non-ok responses —
 * successful responses (including their Set-Cookie headers) must pass
 * through untouched.
 */
export function normaliseBetterAuthError(input: BetterAuthErrorInput): NormalisedAuthError {
  const isSignUp = input.path.includes("/sign-up");
  const isSignIn = input.path.includes("/sign-in");

  if (isSignUp && isDuplicateEmail(input.status, input.body)) {
    const message = "An account with this email already exists";
    return {
      status: 409,
      body: {
        error: {
          message,
          data: {
            appCode: "conflict",
            conflictReason: "duplicate_email",
            fieldErrors: [{ field: "email", message }],
            requestId: input.requestId,
          },
        },
      },
    };
  }

  if (isSignIn && isBadCredentials(input.status, input.body)) {
    // R-21: identical message regardless of which of email/password was
    // wrong — never reveal whether the email is registered.
    const message = "Invalid email or password";
    return {
      status: 401,
      body: {
        error: {
          message,
          data: { appCode: "unauthenticated", requestId: input.requestId },
        },
      },
    };
  }

  return {
    status: 500,
    body: {
      error: {
        message: "Internal error",
        data: { appCode: "internal_error", requestId: input.requestId },
      },
    },
  };
}
