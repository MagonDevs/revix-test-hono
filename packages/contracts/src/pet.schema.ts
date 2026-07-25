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
import { paginatedSchema } from "./pagination.js";
import { userSummarySchema } from "./user.schema.js";

// §6.4 — PetPhoto. Array order is meaningful; index 0 is the cover photo.
export const petPhotoSchema = z.object({
  id: z.uuid(),
  url: z.string(), // e.g. '/api/uploads/<uploadId>/raw'
  alt: z.string().nullable(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});
export type PetPhoto = z.infer<typeof petPhotoSchema>;

// §6.5 — Pet
export const petSchema = z.object({
  id: z.uuid(),
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
  createdAt: z.date(),
  updatedAt: z.date(),
});
export type Pet = z.infer<typeof petSchema>;

// §6.6 — OwnedPet, only from pets.listMine.
export const ownedPetSchema = petSchema.extend({
  pendingRequestCount: z.number().int().nonnegative(),
});
export type OwnedPet = z.infer<typeof ownedPetSchema>;

// §8.3 — pets.list
export const petsListInputSchema = z.strictObject({
  q: z.string().trim().min(1).max(LIMITS.list.searchMax).optional(),
  species: z.array(speciesSchema).min(1).max(5).optional(),
  size: z.array(petSizeSchema).min(1).max(3).optional(),
  sex: sexSchema.optional(),
  ageGroup: ageGroupSchema.optional(),
  city: z.string().trim().min(1).max(LIMITS.pet.cityMax).optional(),
  sort: petSortSchema.default("newest"),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(LIMITS.list.perPageMax).default(LIMITS.list.perPageDefault),
});
export type PetsListInput = z.infer<typeof petsListInputSchema>;
export const petsListOutputSchema = paginatedSchema(petSchema);

// §8.3 — pets.byId
export const petsByIdInputSchema = z.strictObject({
  petId: z.uuid(),
});
export type PetsByIdInput = z.infer<typeof petsByIdInputSchema>;

// §8.3 — pets.listByOwner
export const petsListByOwnerInputSchema = z.strictObject({
  ownerId: z.string(),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(LIMITS.list.perPageMax).default(LIMITS.list.perPageDefault),
});
export type PetsListByOwnerInput = z.infer<typeof petsListByOwnerInputSchema>;
export const petsListByOwnerOutputSchema = paginatedSchema(petSchema);

// §8.3 — pets.listMine
export const petsListMineInputSchema = z.strictObject({
  status: petStatusSchema.optional(),
  sort: petSortSchema.default("newest"),
  page: z.number().int().positive().default(1),
  perPage: z.number().int().min(1).max(LIMITS.list.perPageMax).default(LIMITS.list.perPageDefault),
});
export type PetsListMineInput = z.infer<typeof petsListMineInputSchema>;
export const petsListMineOutputSchema = paginatedSchema(ownedPetSchema);

// §8.3 — pets.create
export const petPhotoInputSchema = z.strictObject({
  uploadId: z.uuid(),
  alt: z.string().max(LIMITS.pet.altMax).nullable().optional(),
});
export type PetPhotoInput = z.infer<typeof petPhotoInputSchema>;

export const createPetInputSchema = z.strictObject({
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
export type CreatePetInput = z.infer<typeof createPetInputSchema>;

export const petsCreateInputSchema = createPetInputSchema;
export type PetsCreateInput = z.infer<typeof petsCreateInputSchema>;

// §8.3 — pets.update: any subset of the create fields, plus the petId,
// with at least one field present.
export const petsUpdateInputSchema = z
  .object({ petId: z.uuid() })
  .extend(createPetInputSchema.partial().shape)
  .strict()
  .refine((v) => Object.keys(v).length > 1, {
    message: "At least one field is required",
  });
export type PetsUpdateInput = z.infer<typeof petsUpdateInputSchema>;

// §8.3 — pets.setStatus
export const petsSetStatusInputSchema = z.strictObject({
  petId: z.uuid(),
  status: petStatusSchema,
  declinePendingRequests: z.boolean().default(true),
});
export type PetsSetStatusInput = z.infer<typeof petsSetStatusInputSchema>;

// §8.3 — pets.remove
export const petsRemoveInputSchema = z.strictObject({
  petId: z.uuid(),
});
export type PetsRemoveInput = z.infer<typeof petsRemoveInputSchema>;
export const petsRemoveOutputSchema = z.object({ id: z.uuid() });
export type PetsRemoveOutput = z.infer<typeof petsRemoveOutputSchema>;
