import { z } from "zod";
import { LIMITS } from "./constraints.js";
import {
  ageGroupSchema,
  petSizeSchema,
  petSortSchema,
  petStatusSchema,
  requestStatusSchema,
  sexSchema,
  speciesSchema,
} from "./enums.js";
import { paginatedSchema, paginationQuerySchema } from "./pagination.js";
import { idSchema, isoDateTimeSchema, repeatable } from "./primitives.js";
import { userSummarySchema } from "./user.schema.js";

export const petPhotoSchema = z.object({
  id: idSchema,
  url: z.string(),
  alt: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type PetPhoto = z.infer<typeof petPhotoSchema>;

export const petSchema = z.object({
  id: idSchema,
  name: z.string(),
  species: speciesSchema,
  breed: z.string().nullable(),
  sex: sexSchema,
  ageMonths: z.number().int().nonnegative(),
  size: petSizeSchema,
  weightKg: z.number().nullable(),
  description: z.string(),
  photos: z.array(petPhotoSchema),
  city: z.string(),
  status: petStatusSchema,
  isVaccinated: z.boolean(),
  isNeutered: z.boolean(),
  isGoodWithKids: z.boolean(),
  isGoodWithPets: z.boolean(),
  isFavourited: z.boolean(),
  viewerRequestStatus: requestStatusSchema.nullable(),
  guardian: userSummarySchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});
export type Pet = z.infer<typeof petSchema>;

export const ownedPetSchema = petSchema.extend({
  pendingRequestCount: z.number().int().nonnegative(),
});
export type OwnedPet = z.infer<typeof ownedPetSchema>;

export const petIdParamsSchema = z.object({ petId: idSchema });
export type PetIdParams = z.infer<typeof petIdParamsSchema>;

export const petsListQuerySchema = z.object({
  q: z.string().trim().min(1).max(LIMITS.list.searchMax).optional(),
  species: repeatable(speciesSchema).pipe(z.array(speciesSchema).min(1).max(5)).optional(),
  size: repeatable(petSizeSchema).pipe(z.array(petSizeSchema).min(1).max(3)).optional(),
  sex: sexSchema.optional(),
  ageGroup: ageGroupSchema.optional(),
  city: z.string().trim().min(1).max(LIMITS.pet.cityMax).optional(),
  sort: petSortSchema.default("newest"),
  ...paginationQuerySchema.shape,
});
export type PetsListInput = z.infer<typeof petsListQuerySchema>;
export const petsListOutputSchema = paginatedSchema(petSchema);

export const petsListByOwnerQuerySchema = paginationQuerySchema;
export type PetsListByOwnerInput = { ownerId: string } & z.infer<typeof petsListByOwnerQuerySchema>;
export const petsListByOwnerOutputSchema = paginatedSchema(petSchema);

export const petsListMineQuerySchema = z.object({
  status: petStatusSchema.optional(),
  sort: petSortSchema.default("newest"),
  ...paginationQuerySchema.shape,
});
export type PetsListMineInput = z.infer<typeof petsListMineQuerySchema>;
export const petsListMineOutputSchema = paginatedSchema(ownedPetSchema);

export const petPhotoInputSchema = z.strictObject({
  uploadId: idSchema,
  alt: z.string().max(LIMITS.pet.altMax).nullable().optional(),
});
export type PetPhotoInput = z.infer<typeof petPhotoInputSchema>;

export const createPetRequestSchema = z.strictObject({
  name: z.string().trim().min(LIMITS.pet.nameMin).max(LIMITS.pet.nameMax),
  species: speciesSchema,
  breed: z.string().trim().max(LIMITS.pet.breedMax).nullable().optional(),
  sex: sexSchema,
  ageMonths: z.number().int().min(LIMITS.pet.ageMonthsMin).max(LIMITS.pet.ageMonthsMax),
  size: petSizeSchema,
  weightKg: z
    .number()
    .min(LIMITS.pet.weightKgMin)
    .max(LIMITS.pet.weightKgMax)
    .multipleOf(0.1)
    .nullable()
    .optional(),
  description: z.string().trim().min(LIMITS.pet.descriptionMin).max(LIMITS.pet.descriptionMax),
  city: z.string().trim().min(LIMITS.pet.cityMin).max(LIMITS.pet.cityMax),
  photos: z.array(petPhotoInputSchema).min(LIMITS.pet.photosMin).max(LIMITS.pet.photosMax),
  isVaccinated: z.boolean().default(false),
  isNeutered: z.boolean().default(false),
  isGoodWithKids: z.boolean().default(false),
  isGoodWithPets: z.boolean().default(false),
});
export type CreatePetInput = z.infer<typeof createPetRequestSchema>;

export const updatePetRequestSchema = createPetRequestSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });
export type UpdatePetRequest = z.infer<typeof updatePetRequestSchema>;

export type PetsUpdateInput = { petId: string } & UpdatePetRequest;

export const updatePetStatusRequestSchema = z.strictObject({
  status: petStatusSchema,
  declinePendingRequests: z.boolean().default(true),
});
export type UpdatePetStatusRequest = z.infer<typeof updatePetStatusRequestSchema>;

export const petReportRequestSchema = z.strictObject({
  reason: z.string().trim().min(LIMITS.pet.reportReasonMin).max(LIMITS.pet.reportReasonMax),
});
export type PetReportRequest = z.infer<typeof petReportRequestSchema>;

export const petReportOutputSchema = z.object({
  petId: idSchema,
  received: z.boolean(),
});
export type PetReportOutput = z.infer<typeof petReportOutputSchema>;

export type PetsSetStatusInput = { petId: string } & UpdatePetStatusRequest;
