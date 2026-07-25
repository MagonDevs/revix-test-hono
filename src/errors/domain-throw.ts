import { AppErrors, type AppError } from "./app-error.js";

export class DomainThrow extends Error {
  readonly appError: AppError;

  constructor(appError: AppError) {
    super(appError.message);
    this.name = "DomainThrow";
    this.appError = appError;
  }
}

export function toAppError(cause: unknown): AppError {
  if (cause instanceof DomainThrow) return cause.appError;
  const message = cause instanceof Error ? cause.message : "Unexpected error";
  return AppErrors.internal(message, cause);
}
