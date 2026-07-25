import { z } from "zod";
import { LIMITS } from "./constraints.js";
import { petStatusSchema, requestRoleSchema, requestStatusSchema } from "./enums.js";
import { paginatedSchema, paginationQuerySchema } from "./pagination.js";
import { petPhotoSchema } from "./pet.schema.js";
import { idSchema, isoDateTimeSchema } from "./primitives.js";
import { userSummarySchema } from "./user.schema.js";

// §6.7 — AdoptionRequest
export const adoptionRequestSchema = z.object({
  id: idSchema,
  status: requestStatusSchema,
  message: z.string(),
  pet: z.object({
    id: idSchema,
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
  createdAt: isoDateTimeSchema,
  respondedAt: isoDateTimeSchema.nullable(),
});
export type AdoptionRequest = z.infer<typeof adoptionRequestSchema>;

// Path params for /adoption-requests/:requestId[/status].
export const requestIdParamsSchema = z.object({ requestId: idSchema });
export type RequestIdParams = z.infer<typeof requestIdParamsSchema>;

// POST /pets/:petId/adoption-requests — the pet id is in the path.
export const createAdoptionRequestRequestSchema = z.strictObject({
  message: z
    .string()
    .trim()
    .min(LIMITS.adoptionRequest.messageMin)
    .max(LIMITS.adoptionRequest.messageMax),
});
export type CreateAdoptionRequestRequest = z.infer<typeof createAdoptionRequestRequestSchema>;

/** What `adoptionRequests.service.create` consumes. */
export type AdoptionRequestsCreateInput = { petId: string } & CreateAdoptionRequestRequest;

// GET /me/adoption-requests — `role` is required and has no default: the
// two roles are different inboxes, and guessing one would silently show
// the caller the wrong list.
export const adoptionRequestsListQuerySchema = z.object({
  role: requestRoleSchema,
  status: requestStatusSchema.optional(),
  petId: idSchema.optional(),
  ...paginationQuerySchema.shape,
});
export type AdoptionRequestsListInput = z.infer<typeof adoptionRequestsListQuerySchema>;
export const adoptionRequestsListOutputSchema = paginatedSchema(adoptionRequestSchema);

// PATCH /adoption-requests/:requestId/status
export const respondToRequestRequestSchema = z.strictObject({
  status: z.enum(["accepted", "declined"]),
  reservePet: z.boolean().default(false),
});
export type RespondToRequestRequest = z.infer<typeof respondToRequestRequestSchema>;

/** What `adoptionRequests.service.respond` consumes. */
export type AdoptionRequestsRespondInput = { requestId: string } & RespondToRequestRequest;
