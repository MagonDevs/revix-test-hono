import { z } from "zod";

// §6.8 — Upload
export const uploadSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  byteSize: z.number().int().positive(),
});
export type Upload = z.infer<typeof uploadSchema>;
