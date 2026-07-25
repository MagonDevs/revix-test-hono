import { z } from "zod";
import { LIMITS } from "./constraints.js";

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  perPage: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), meta: paginationMetaSchema });
}

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIMITS.list.perPageMax)
    .default(LIMITS.list.perPageDefault),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
