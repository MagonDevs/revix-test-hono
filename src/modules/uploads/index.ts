// Module public API (architecture §2.1). `pets.service` calls
// `verifyOwnedUnconsumed`/`consumeUploads` through here, passing its own
// transaction — never `uploads.repository` directly.

export {
  checkSize,
  consumeUploads,
  createUpload,
  getUploadBytes,
  isAllowedMime,
  sniffMime,
  verifyOwned,
  verifyOwnedUnconsumed,
} from "./uploads.service.js";
export type { CreateUploadDeps } from "./uploads.service.js";
export { findUnconsumedOlderThan, deleteById } from "./uploads.repository.js";
export type { UploadRow } from "./uploads.repository.js";
