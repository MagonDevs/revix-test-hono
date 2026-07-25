export interface NormalizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: "webp";
}

export interface ImagePort {
  normalize(bytes: Uint8Array, opts: { maxEdgePx: number }): Promise<NormalizedImage>;
}
