import { z } from "zod";
import { LIMITS } from "./constraints.js";
import { petStatusSchema, requestRoleSchema, requestStatusSchema } from "./enums.js";
import { paginatedSchema, paginationQuerySchema } from "./pagination.js";
import { petPhotoSchema } from "./pet.schema.js";
import { idSchema, isoDateTimeSchema } from "./primitives.js";
import { userSummarySchema } from "./user.schema.js";

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

export const requestIdParamsSchema = z.object({ requestId: idSchema });
export type RequestIdParams = z.infer<typeof requestIdParamsSchema>;

export const createAdoptionRequestRequestSchema = z.strictObject({
  message: z
    .string()
    .trim()
    .min(LIMITS.adoptionRequest.messageMin)
    .max(LIMITS.adoptionRequest.messageMax),
});
export type CreateAdoptionRequestRequest = z.infer<typeof createAdoptionRequestRequestSchema>;

export type AdoptionRequestsCreateInput = { petId: string } & CreateAdoptionRequestRequest;

export const adoptionRequestsListQuerySchema = z.object({
  role: requestRoleSchema,
  status: requestStatusSchema.optional(),
  petId: idSchema.optional(),
  ...paginationQuerySchema.shape,
});
export type AdoptionRequestsListInput = z.infer<typeof adoptionRequestsListQuerySchema>;
export const adoptionRequestsListOutputSchema = paginatedSchema(adoptionRequestSchema);

export const respondToRequestRequestSchema = z.strictObject({
  status: z.enum(["accepted", "declined"]),
  reservePet: z.boolean().default(false),
});
export type RespondToRequestRequest = z.infer<typeof respondToRequestRequestSchema>;

export type AdoptionRequestsRespondInput = { requestId: string } & RespondToRequestRequest;
