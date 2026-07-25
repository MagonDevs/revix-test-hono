import { z } from "zod";
import { LIMITS } from "./constraints.js";
import { petStatusSchema, requestRoleSchema, requestStatusSchema } from "./enums.js";
import { paginatedSchema } from "./pagination.js";
import { petPhotoSchema } from "./pet.schema.js";
import { userSummarySchema } from "./user.schema.js";

// §6.7 — AdoptionRequest
export const adoptionRequestSchema = z.object({
  id: z.uuid(),
  status: requestStatusSchema,
  message: z.string(),
  pet: z.object({
    id: z.uuid(),
    name: z.string(),
    status: petStatusSchema,
    coverPhoto: petPhotoSchema.nullable(),
  }),
  adopter: userSummarySchema,
  guardian: userSummarySchema,
  contact: z
    .object({
      email: z.string(),
      phone: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.date(),
  respondedAt: z.date().nullable(),
});
export type AdoptionRequest = z.infer<typeof adoptionRequestSchema>;

// §8.4 — adoptionRequests.create
export const adoptionRequestsCreateInputSchema = z.strictObject({
  petId: z.uuid(),
  message: z
    .string()
    .trim()
    .min(LIMITS.adoptionRequest.messageMin)
    .max(LIMITS.adoptionRequest.messageMax),
});
export type AdoptionRequestsCreateInput = z.infer<typeof adoptionRequestsCreateInputSchema>;

// §8.4 — adoptionRequests.list
export const adoptionRequestsListInputSchema = z.strictObject({
  role: requestRoleSchema, // REQUIRED, no default
  status: requestStatusSchema.optional(),
  petId: z.uuid().optional(),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(LIMITS.list.perPageMax).default(LIMITS.list.perPageDefault),
});
export type AdoptionRequestsListInput = z.infer<typeof adoptionRequestsListInputSchema>;
export const adoptionRequestsListOutputSchema = paginatedSchema(adoptionRequestSchema);

// §8.4 — adoptionRequests.byId
export const adoptionRequestsByIdInputSchema = z.strictObject({
  requestId: z.uuid(),
});
export type AdoptionRequestsByIdInput = z.infer<typeof adoptionRequestsByIdInputSchema>;

// §8.4 — adoptionRequests.respond
export const adoptionRequestsRespondInputSchema = z.strictObject({
  requestId: z.uuid(),
  status: z.enum(["accepted", "declined"]),
  reservePet: z.boolean().default(false),
});
export type AdoptionRequestsRespondInput = z.infer<typeof adoptionRequestsRespondInputSchema>;

// §8.4 — adoptionRequests.withdraw
export const adoptionRequestsWithdrawInputSchema = z.strictObject({
  requestId: z.uuid(),
});
export type AdoptionRequestsWithdrawInput = z.infer<typeof adoptionRequestsWithdrawInputSchema>;
