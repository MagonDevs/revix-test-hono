import { DomainThrow } from "../../errors/domain-throw.js";
import type { AppError } from "../../errors/app-error.js";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Result } from "neverthrow";
import type { z } from "zod";

export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value;
  throw new DomainThrow(result.error);
}

export function json<S extends z.ZodType>(
  c: Context,
  schema: S,
  value: z.input<S>,
  status: ContentfulStatusCode = 200,
): Response {
  return c.json(schema.parse(value) as object, status);
}

export function noContent(c: Context): Response {
  return c.body(null, 204);
}
