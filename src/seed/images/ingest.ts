import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { SharpImageAdapter } from "../../adapters/sharp.adapter.js";
import { generateOfflineImage } from "./offline.js";
import type { Species } from "#contracts";
import type { StoragePort } from "../../ports/storage.port.js";

// Spec §5.1/§5.2 `ingest` mode: "Download once from a provider, run the
// real sharp pipeline, write to storage, insert uploads rows. Cached in
// .seed-cache/ so re-seeding is instant and offline."
//
// docs/notes/seed-images.md: providers must be fetched with GET (cataas
// 404s on HEAD, picsum 405s), and redirects must be followed (loremflickr,
// picsum both 302). `fetch` does both by default.

const CACHE_DIR = new URL("../../../.seed-cache/", import.meta.url).pathname;
const FETCH_TIMEOUT_MS = 6000;
const MAX_RETRIES = 2;
const MAX_EDGE_PX = 1600;

const imageAdapter = new SharpImageAdapter();

function cacheKeyFor(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

function cachePathFor(url: string): string {
  const key = cacheKeyFor(url);
  return join(CACHE_DIR, key.slice(0, 2), `${key}.bin`);
}

async function readCache(url: string): Promise<Uint8Array | null> {
  try {
    return await readFile(cachePathFor(url));
  } catch {
    return null;
  }
}

async function writeCache(url: string, bytes: Uint8Array): Promise<void> {
  const path = cachePathFor(url);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}

async function fetchWithRetry(url: string): Promise<Uint8Array | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      // fall through to retry / give up
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

export interface IngestResult {
  bytes: Uint8Array;
  width: number;
  height: number;
  format: "webp";
  /** Whether the pipeline fell through to an offline render for this image. */
  fellBackOffline: boolean;
}

/**
 * Downloads (or reads from cache) the image at `url`, runs it through
 * the real sharp normalise pipeline, and returns the processed bytes.
 * On network failure after retries, falls through to a locally
 * generated offline image instead of failing the whole seed.
 */
export async function ingestImage(
  url: string,
  fallback: { name: string; species: Species; width: number; height: number },
): Promise<IngestResult> {
  let raw = await readCache(url);
  let fromNetwork = false;

  if (!raw) {
    raw = await fetchWithRetry(url);
    fromNetwork = raw !== null;
  }

  if (!raw) {
    const offline = await generateOfflineImage(
      fallback.name,
      fallback.species,
      fallback.width,
      fallback.height,
    );
    return { ...offline, format: "webp", fellBackOffline: true };
  }

  if (fromNetwork) await writeCache(url, raw);

  const normalized = await imageAdapter.normalize(raw, { maxEdgePx: MAX_EDGE_PX });
  return { ...normalized, fellBackOffline: false };
}

export interface StoredUploadRow {
  id: string;
  uploaderId: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  createdAt: Date;
}

/** Writes normalised bytes to storage and returns the row shape for `uploads`. */
export async function persistIngestedImage(
  storage: StoragePort,
  result: Pick<IngestResult, "bytes" | "width" | "height">,
  meta: { id: string; uploaderId: string; storageKey: string; createdAt: Date },
): Promise<StoredUploadRow> {
  await storage.put(meta.storageKey, result.bytes);
  return {
    id: meta.id,
    uploaderId: meta.uploaderId,
    storageKey: meta.storageKey,
    mimeType: "image/webp",
    byteSize: result.bytes.byteLength,
    width: result.width,
    height: result.height,
    createdAt: meta.createdAt,
  };
}
