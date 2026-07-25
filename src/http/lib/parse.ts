import { AppErrors } from "../../errors/app-error.js";
import { DomainThrow } from "../../errors/domain-throw.js";
import { scrubInput } from "./scrub.js";
import type { FieldError } from "#contracts";
import type { AppVariables } from "../context.js";
import type { Context } from "hono";
import type { z } from "zod";

function fieldErrorsFrom(error: z.ZodError): FieldError[] {
  return error.issues.map((issue) => ({
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

export function parseQuery<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  const raw: Record<string, string | string[]> = {};
  for (const [key, values] of Object.entries(c.req.queries())) {
    const present = values.filter((v) => v.length > 0);
    if (present.length === 0) continue;
    raw[key] = present.length === 1 ? (present[0] as string) : present;
  }
  return parseOrThrow(schema, raw);
}

export function parseParams<S extends z.ZodType>(c: Context, schema: S): z.output<S> {
  return parseOrThrow(schema, c.req.param());
}
