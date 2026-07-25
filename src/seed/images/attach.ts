import { dimensionsFor } from "../factories/pet.factory.js";
import { ingestImage } from "./ingest.js";
import { generateOfflineImage } from "./offline.js";
import { imageUrlFor } from "./providers.js";
import type { Species } from "#contracts";
import type { StoragePort } from "../../ports/storage.port.js";

export type SeedImageMode = "ingest" | "remote" | "offline";

export interface UploadRow {
  id: string;
  uploaderId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: Date;
}

export interface PetPhotoRow {
  id: string;
  petId: string;
  uploadId: string;
  position: number;
  alt: string | null;
}

export interface AttachPhotosResult {
  uploads: UploadRow[];
  photos: PetPhotoRow[];
}

export interface AttachPhotosInput {
  petId: string;
  ownerId: string;
  species: Species;
  name: string;
  count: number;
  createdAt: Date;
  mode: SeedImageMode;
  storage: StoragePort;
  nextId: () => string;
}

export async function attachPhotos(input: AttachPhotosInput): Promise<AttachPhotosResult> {
  const uploads: UploadRow[] = [];
  const photos: PetPhotoRow[] = [];

  for (let position = 0; position < input.count; position++) {
    const { width, height } = dimensionsFor(position);
    const uploadId = input.nextId();
    const photoId = input.nextId();
    let storageKey: string;
    let mimeType = "image/webp";
    let byteSize: number;
    let outWidth = width;
    let outHeight = height;

    if (input.mode === "remote") {
      storageKey = imageUrlFor(input.species, position, width, height);
      byteSize = 0;
      mimeType = "image/jpeg";
    } else if (input.mode === "offline") {
      const rendered = await generateOfflineImage(input.name, input.species, width, height);
      storageKey = `uploads/seed/${uploadId}.webp`;
      await input.storage.put(storageKey, rendered.bytes);
      byteSize = rendered.bytes.byteLength;
      outWidth = rendered.width;
      outHeight = rendered.height;
    } else {
      const url = imageUrlFor(input.species, position, width, height);
      const result = await ingestImage(url, {
        name: input.name,
        species: input.species,
        width,
        height,
      });
      storageKey = `uploads/seed/${uploadId}.webp`;
      await input.storage.put(storageKey, result.bytes);
      byteSize = result.bytes.byteLength;
      outWidth = result.width;
      outHeight = result.height;
    }

    uploads.push({
      id: uploadId,
      uploaderId: input.ownerId,
      storageKey,
      mimeType,
      byteSize,
      width: outWidth,
      height: outHeight,
      createdAt: input.createdAt,
    });
    photos.push({
      id: photoId,
      petId: input.petId,
      uploadId,
      position,
      alt: null,
    });
  }

  return { uploads, photos };
}
