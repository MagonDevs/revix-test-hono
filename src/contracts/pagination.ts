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

// Common pagination input fragment shared by list procedures.
export const paginationInputSchema = z.object({
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(LIMITS.list.perPageMax).default(LIMITS.list.perPageDefault),
});
