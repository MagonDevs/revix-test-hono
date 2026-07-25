// Architecture §2, §7 — a StoragePort so a second (S3) implementation is
// a new adapter, not a rewrite. Keys are always server-generated
// (`uploads/<yyyy>/<mm>/<uuid>.webp`); no part of a key comes from user
// input.
export interface StoragePort {
  put(key: string, bytes: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}
