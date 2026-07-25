import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import type { StoragePort } from "../ports/storage.port.js";

/**
 * Local filesystem StoragePort. `baseDir` is the root all keys are
 * resolved under; keys are always server-generated, never derived from
 * user input, but the path is still normalised and bounds-checked
 * defensively.
 */
export class LocalStorageAdapter implements StoragePort {
  private readonly baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private resolve(key: string): string {
    const resolved = normalize(join(this.baseDir, key));
    if (
      !resolved.startsWith(normalize(this.baseDir) + sep) &&
      resolved !== normalize(this.baseDir)
    ) {
      throw new Error(`Storage key escapes base directory: ${key}`);
    }
    return resolved;
  }

  async put(key: string, bytes: Uint8Array): Promise<void> {
    const path = this.resolve(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      return await readFile(this.resolve(key));
    } catch (err) {
      if (err instanceof Error && "code" in err && err.code === "ENOENT") return null;
      throw err;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.resolve(key), { force: true });
  }
}
