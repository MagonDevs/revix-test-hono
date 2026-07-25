// Architecture §2, §7 — wraps sharp. Full pipeline (EXIF stripping,
// auto-rotate, content sniffing, size guards) is upload-pipeline scope
// (B6); this is the minimal shape needed to unblock that work later.
export interface NormalizedImage {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: "webp";
}

export interface ImagePort {
  /**
   * Normalises arbitrary input image bytes: auto-rotate, strip EXIF, cap
   * the long edge at `maxEdgePx`, re-encode to WebP. Dimensions are read
   * from the *output*, not the input.
   */
  normalize(bytes: Uint8Array, opts: { maxEdgePx: number }): Promise<NormalizedImage>;
}
