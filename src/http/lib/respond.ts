import { DomainThrow } from "../../errors/domain-throw.js";
import type { AppError } from "../../errors/app-error.js";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { Result } from "neverthrow";
import type { z } from "zod";

// Architecture §4, §6 — the response boundary. Nothing returns a `Result`
// across it: `unwrap` turns `Err` into a throw that `httpErrorHandler`
// renders, and `Ok` into the plain value.

/**
 * `Ok(value)` passes through; `Err(appError)` is thrown as a `DomainThrow`.
 * Call this at the route boundary, once the service has done its work.
 */
export function unwrap<T>(result: Result<T, AppError>): T {
  if (result.isOk()) return result.value;
  throw new DomainThrow(result.error);
}

/**
 * Serialises a response *through its contract schema*. This is the output
 * guard the transport owes the contract: a handler that drifts from it —
 * a leaked `email` on a `UserSummary` (R-22), a `Date` where the wire
 * wants an ISO string — fails here rather than reaching a client. Parsing
 * also strips unknown keys, so an extra column picked up by a repository
 * query can never escape by accident.
 *
 * A mismatch is a server bug, not a client one, so it surfaces as an
 * `internal_error` (via the thrown ZodError) and is logged with the
 * offending detail.
 */
export function json<S extends z.ZodType>(
  c: Context,
  schema: S,
  value: z.input<S>,
  status: ContentfulStatusCode = 200,
): Response {
  return c.json(schema.parse(value) as object, status);
}

/** A 204 for the mutations whose result is fully implied by the request. */
export function noContent(c: Context): Response {
  return c.body(null, 204);
}
