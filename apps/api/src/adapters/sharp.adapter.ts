import sharp from "sharp";
import type { ImagePort, NormalizedImage } from "../ports/image.port.js";

/**
 * Thin sharp-backed ImagePort. Auto-rotates (per EXIF orientation), then
 * strips all metadata (including EXIF/GPS), caps the long edge, and
 * re-encodes to WebP. The full upload pipeline (content sniffing, size
 * guards while streaming, storage insertion) is B6 scope — this adapter
 * only owns the image transform.
 */
export class SharpImageAdapter implements ImagePort {
  async normalize(bytes: Uint8Array, opts: { maxEdgePx: number }): Promise<NormalizedImage> {
    const pipeline = sharp(bytes)
      .rotate()
      .resize({
        width: opts.maxEdgePx,
        height: opts.maxEdgePx,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp();

    const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });

    return {
      bytes: data,
      width: info.width,
      height: info.height,
      format: "webp",
    };
  }
}
