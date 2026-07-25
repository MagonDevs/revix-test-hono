import { z } from "zod";

export const idSchema = z.uuid();
export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export function repeatable<T extends z.ZodTypeAny>(item: T) {
  return z.union([item, z.array(item)]).transform((v) => (Array.isArray(v) ? v : [v]));
}
