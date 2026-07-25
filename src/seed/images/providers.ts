import { createHash } from "node:crypto";
import type { Species } from "#contracts";

export function stableLock(species: Species, index: number): number {
  const hash = createHash("sha256").update(`${species}:${index}`).digest();
  return hash.readUInt32BE(0);
}

export function imageUrlFor(species: Species, index: number, w = 1200, h = 900): string {
  const lock = stableLock(species, index);
  switch (species) {
    case "dog":
      return `https://placedog.net/${w}/${h}?id=${lock % 200}`;
    case "cat":
      return `https://cataas.com/cat?width=${w}&height=${h}&seed=${lock}`;
    case "rabbit":
    case "bird":
      return `https://loremflickr.com/${w}/${h}/${species}/all?lock=${lock}`;
    default:
      return `https://picsum.photos/seed/adopta-${lock}/${w}/${h}`;
  }
}

export function avatarUrlFor(userId: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(userId)}`;
}
