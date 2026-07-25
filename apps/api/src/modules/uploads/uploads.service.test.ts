import { LIMITS } from "@adopta/contracts";
import { describe, expect, it } from "vitest";
import { checkSize, isAllowedMime, sniffMime } from "./uploads.service.js";

// Pure/no-DB pieces of the upload pipeline (architecture §7 steps 3-4).
// No Docker required.

// 1x1 PNG (real magic bytes) — proves content-sniffing works on real
// bytes rather than a mocked detector.
const ONE_PX_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
    "base64",
  ),
);

describe("checkSize", () => {
  it("accepts a file at the limit", () => {
    expect(checkSize(LIMITS.upload.maxBytes)).toBeNull();
  });

  it("rejects a file over LIMITS.upload.maxBytes with a specific message (6MB case)", () => {
    const sixMb = 6 * 1024 * 1024;
    const error = checkSize(sixMb);
    expect(error).not.toBeNull();
    expect(error?.code).toBe("validation_error");
    if (error?.code === "validation_error") {
      expect(error.fieldErrors[0]?.field).toBe("file");
      expect(error.fieldErrors[0]?.message).toContain(String(LIMITS.upload.maxBytes));
    }
  });
});

describe("isAllowedMime", () => {
  it.each(LIMITS.upload.mimeTypes)("allows %s", (mime) => {
    expect(isAllowedMime(mime)).toBe(true);
  });

  it("rejects an unlisted type", () => {
    expect(isAllowedMime("image/gif")).toBe(false);
  });

  it("rejects undefined (sniff failed / not an image)", () => {
    expect(isAllowedMime(undefined)).toBe(false);
  });
});

describe("sniffMime", () => {
  it("detects the real type from magic bytes, regardless of any declared type", async () => {
    const mime = await sniffMime(ONE_PX_PNG);
    expect(mime).toBe("image/png");
  });

  it("a PNG renamed .jpg is still sniffed as PNG and is on the allow-list", async () => {
    // The route never trusts the filename/declared content-type (architecture
    // §7 step 4) — sniffing only ever looks at the bytes, so a `.jpg`
    // filename on these PNG bytes changes nothing here, and PNG is itself
    // in LIMITS.upload.mimeTypes, so it's correctly accepted rather than
    // rejected for a mismatched extension.
    const mime = await sniffMime(ONE_PX_PNG);
    expect(isAllowedMime(mime)).toBe(true);
    expect(mime).toBe("image/png");
  });

  it("returns undefined for non-image bytes", async () => {
    const mime = await sniffMime(new TextEncoder().encode("not an image, just text"));
    expect(mime).toBeUndefined();
  });
});
