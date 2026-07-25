import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { scrubInput } from "./scrub.js";
import type { FieldError } from "#contracts";
import type { AppVariables } from "../context.js";
import type { Context } from "hono";
import type { z } from "zod";

// Architecture §3 — the request-parsing boundary. A route never touches
// `c.req.json()` / `c.req.query()` directly: it declares a contract schema
// and gets a parsed, typed value or a `validation_error` describing exactly
// which fields were wrong.
//
// Failures are raised as `DomainThrow` rather than returned, so a handler
// reads as a straight line and `httpErrorHandler` renders every failure —
// parse, service, or unexpected — through the same converter.

function fieldErrorsFrom(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    // `path` is empty for a whole-object refinement (e.g. "at least one
    // field is required"); `(root)` keeps the field non-empty so a client
    // rendering errors by field never has to special-case a blank key.
    field: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

function parseOrThrow<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new DomainThrow(AppErrors.validation(fieldErrorsFrom(result.error)));
  }
  return result.data;
}

/**
 * Parses a JSON request body. An absent or empty body is treated as `{}`
 * so a schema whose fields all have defaults still succeeds; a malformed
 * one is a `validation_error` on `(root)`, never a 500.
 */
export async function parseBody<S extends z.ZodType>(
  c: Context<{ Variables: AppVariables }>,
  schema: S,
): Promise<z.output<S>> {
  const raw = await c.req.text();
  if (raw.trim().length === 0) return parseOrThrow(schema, {});

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new DomainThrow(AppErrors.invalidField("(root)", "Request body is not valid JSON"));
  }

  c.set("scrubbedBody", scrubInput(json));
  return parseOrThrow(schema, json);
}

/**
 * Parses the query string. A parameter that appears once is handed to the
 * schema as a bare string and one that repeats as an array of strings —
 * `repeatable()` (contracts/primitives.ts) accepts both. Empty values are
 * dropped rather than passed through as `""`, so `?city=` means "no city
 * filter" instead of "a city whose name is the empty string".
 */
export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const raw: Record<string, string | string[]> = {};
  for (const [key, values] of Object.entries(c.req.queries())) {
    const present = values.filter((v) => v.length > 0);
    if (present.length === 0) continue;
    raw[key] = present.length === 1 ? (present[0] as string) : present;
  }
  return parseOrThrow(schema, raw);
}

/**
 * Parses the path params. A malformed id here is a 400 rather than a 404:
 * `/pets/not-a-uuid` is a bad request, and answering 404 would imply the
 * shape was fine and the row merely absent.
 */
export function parseParams<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  return parseOrThrow(schema, c.req.param());
}
