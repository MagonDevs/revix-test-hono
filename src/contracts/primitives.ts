import { z } from "zod";

// §2 — Wire primitives shared by every schema in this folder.
//
// The transport is plain JSON over HTTP (no superjson), so a timestamp
// crosses the wire as an RFC 3339 string, never a `Date`. `offset: true`
// accepts both the `Z` form `Date.prototype.toISOString` produces and an
// explicit numeric offset, so a client is free to send either back.

export const idSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

/**
 * A query parameter that may legitimately repeat (`?species=dog&species=cat`).
 * `parseQuery` (http/lib/parse.ts) hands a bare string through for a single
 * occurrence and an array for several, so both forms are accepted here and
 * normalised to an array before the caller's own array constraints run.
 */
export function repeatable<T extends z.ZodTypeAny>(item: T) {
  return z.union([item, z.array(item)]).transform((v) => (Array.isArray(v) ? v : [v]));
}
