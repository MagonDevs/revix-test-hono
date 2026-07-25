import { createHash } from "node:crypto";
import sharp from "sharp";
import { req } from "../util.js";
import type { Species } from "#contracts";

// Spec §5.1 `offline` mode: "Generate the image locally with sharp — a
// solid tinted WebP with the pet's name and species in the corner. Zero
// network." Used by the `large` scenario and whenever SEED_IMAGE_MODE
// is offline (CI always sets it).

const SPECIES_TINTS: Record<Species, string> = {
  dog: "#c98b52",
  cat: "#7a8bab",
  rabbit: "#d9a6c2",
  bird: "#7fb0a3",
  other: "#a89f91",
};

function tintFor(name: string, species: Species): string {
  // Small deterministic jitter on top of the species base tint so pets
  // of the same species aren't all pixel-identical.
  const hash = createHash("sha256").update(`${species}:${name}`).digest();
  const base = SPECIES_TINTS[species];
  const r = Number.parseInt(base.slice(1, 3), 16);
  const g = Number.parseInt(base.slice(3, 5), 16);
  const b = Number.parseInt(base.slice(5, 7), 16);
  const jitter = (byte: number, channel: number): number =>
    Math.min(255, Math.max(0, channel + (byte % 41) - 20));
  return `rgb(${jitter(req(hash.at(0), "hash byte"), r)}, ${jitter(req(hash.at(1), "hash byte"), g)}, ${jitter(req(hash.at(2), "hash byte"), b)})`;
}

export interface OfflineImageResult {
  bytes: Uint8Array;
  width: number;
  height: number;
}

/**
 * Renders a solid-tinted WebP with the pet's name and species overlaid
 * as text (SVG composited over the tile), entirely offline.
 */
export async function generateOfflineImage(
  name: string,
  species: Species,
  width: number,
  height: number,
): Promise<OfflineImageResult> {
  const tint = tintFor(name, species);
  const label = `${name} · ${species}`;
  const fontSize = Math.round(Math.min(width, height) * 0.055);

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${tint}" />
      <text x="24" y="${height - 24}" font-family="sans-serif" font-size="${fontSize}"
            fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.35)" stroke-width="1">
        ${label}
      </text>
    </svg>
  `;

  const { data, info } = await sharp(Buffer.from(svg)).webp().toBuffer({ resolveWithObject: true });

  return { bytes: data, width: info.width, height: info.height };
}
