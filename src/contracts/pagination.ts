import { z } from "zod";
import { LIMITS } from "./constraints.js";

// §2.1 — Pagination.

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(), // echo of the requested page
  perPage: z.number().int().positive(), // echo of the effective perPage
  total: z.number().int().nonnegative(), // total matching rows, ignoring pagination
  totalPages: z.number().int().nonnegative(), // ceil(total / perPage), 0 when total is 0
});
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({ items: z.array(item), meta: paginationMetaSchema });
}

// Common pagination fragment shared by every list endpoint's query
// string. `z.coerce` because a query parameter is always a string on the
// wire; omitting either one falls back to the contract's defaults.
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
