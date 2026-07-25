import { z } from "zod";
import { idSchema } from "./primitives.js";

// §6.8 — Upload
export const uploadSchema = z.object({
  id: idSchema,
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
});
export type Upload = z.infer<typeof uploadSchema>;

export const uploadIdParamsSchema = z.object({ uploadId: idSchema });
export type UploadIdParams = z.infer<typeof uploadIdParamsSchema>;
