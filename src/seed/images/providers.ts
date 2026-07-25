import { createHash } from "node:crypto";
import type { Species } from "#contracts";

// Spec §5.2. Verified against live providers 2026-07-25 — see
// docs/notes/seed-images.md for the exact findings (GET, not HEAD;
// loremflickr/picsum both redirect and must be fetched with redirects
// followed).

/** Deterministic integer from (species, index) — same pet always gets the same photo. */
export function stableLock(species: Species, index: number): number {
  const hash = createHash("sha256").update(`${species}:${index}`).digest();
  // First 4 bytes as an unsigned 32-bit integer.
  return hash.readUInt32BE(0);
}

export function imageUrlFor(species: Species, index: number, w = 1200, h = 900): string {
  const lock = stableLock(species, index);
  switch (species) {
    case "dog":
      // placedog.net — curated dog photos; ?id= pins a specific one.
      return `https://placedog.net/${w}/${h}?id=${lock % 200}`;
    case "cat":
      // cataas.com — Cat as a Service.
      return `https://cataas.com/cat?width=${w}&height=${h}&seed=${lock}`;
    case "rabbit":
    case "bird":
      // loremflickr.com — keyword-based; ?lock= makes the result stable.
      return `https://loremflickr.com/${w}/${h}/${species}/all?lock=${lock}`;
    default:
      // picsum.photos — deterministic by seed.
      return `https://picsum.photos/seed/adopta-${lock}/${w}/${h}`;
  }
}

/** Spec §5.3 — deterministic keyless avatar, stored as a direct URL reference. */
export function avatarUrlFor(userId: string): string {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(userId)}`;
}
