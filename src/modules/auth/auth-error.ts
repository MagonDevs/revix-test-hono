import { AppErrors } from "../../errors/app-error.js";
import type { AppError } from "../../errors/app-error.js";

export interface BetterAuthErrorInput {
  path: string;
  status: number;
  body: unknown;
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

export function normaliseBetterAuthError(input: BetterAuthErrorInput): AppError {
  const isSignUp = input.path.includes("/sign-up");
  const isSignIn = input.path.includes("/sign-in");

  if (isSignUp && isDuplicateEmail(input.status, input.body)) {
    return AppErrors.conflict("duplicate_email", "An account with this email already exists");
  }

  if (isSignIn && isBadCredentials(input.status, input.body)) {
    return AppErrors.unauthenticated("Invalid email or password");
  }

  return AppErrors.internal(`Unhandled auth failure (${String(input.status)}) at ${input.path}`);
}
