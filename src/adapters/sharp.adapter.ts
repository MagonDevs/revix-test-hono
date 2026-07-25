import sharp from "sharp";
import type { ImagePort, NormalizedImage } from "../ports/image.port.js";

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
