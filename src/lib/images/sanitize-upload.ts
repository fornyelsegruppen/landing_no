import sharp from "sharp";
import { ALLOWED_IMAGE_MIMES, sniffImageMime } from "@/lib/image-mime";
import { uploadSha256 } from "@/lib/images/upload-integrity";

const DEFAULT_MAX_INPUT_BYTES = 10_000_000;
const DEFAULT_MAX_OUTPUT_BYTES = 8_000_000;
const DEFAULT_MAX_PIXELS = 40_000_000;
const DEFAULT_MAX_EDGE = 4096;

export class UnsafeImageUploadError extends Error {
  constructor(
    message: string,
    readonly code:
      | "empty"
      | "too_large"
      | "unsupported"
      | "mime_mismatch"
      | "animated"
      | "invalid"
      | "output_too_large",
  ) {
    super(message);
    this.name = "UnsafeImageUploadError";
  }
}

type SanitizeImageOptions = {
  declaredMime?: string | null;
  maxInputBytes?: number;
  maxOutputBytes?: number;
  maxPixels?: number;
  maxEdge?: number;
};

function normalizedMime(value: string | null | undefined) {
  const mime = value?.split(";", 1)[0]?.trim().toLowerCase();
  return mime === "image/jpg" ? "image/jpeg" : mime || null;
}

function sameMimeFamily(left: string, right: string) {
  if (left === right) return true;
  return [left, right].every((mime) => mime === "image/heic" || mime === "image/heif");
}

export async function sanitizeImageUpload(
  input: Uint8Array,
  options: SanitizeImageOptions = {},
) {
  const bytes = Buffer.from(input);
  if (bytes.byteLength === 0) {
    throw new UnsafeImageUploadError("The image is empty", "empty");
  }
  if (bytes.byteLength > (options.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES)) {
    throw new UnsafeImageUploadError("The image exceeds the upload limit", "too_large");
  }

  const sniffedMime = sniffImageMime(bytes);
  if (!sniffedMime || !ALLOWED_IMAGE_MIMES.has(sniffedMime)) {
    throw new UnsafeImageUploadError("The uploaded file is not a supported image", "unsupported");
  }

  const declaredMime = normalizedMime(options.declaredMime);
  if (declaredMime && (!ALLOWED_IMAGE_MIMES.has(declaredMime) || !sameMimeFamily(declaredMime, sniffedMime))) {
    throw new UnsafeImageUploadError("The declared file type does not match its contents", "mime_mismatch");
  }

  const maxPixels = options.maxPixels ?? DEFAULT_MAX_PIXELS;
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(bytes, {
      animated: true,
      failOn: "warning",
      limitInputPixels: maxPixels,
    }).metadata();
  } catch {
    throw new UnsafeImageUploadError("The image could not be decoded safely", "invalid");
  }

  if ((metadata.pages ?? 1) > 1) {
    throw new UnsafeImageUploadError("Animated or multi-page images are not accepted", "animated");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxPixels) {
    throw new UnsafeImageUploadError("The image dimensions are invalid or too large", "invalid");
  }

  let output: Buffer;
  try {
    output = await sharp(bytes, {
      failOn: "warning",
      limitInputPixels: maxPixels,
      page: 0,
      pages: 1,
    })
      .rotate()
      .resize({
        width: options.maxEdge ?? DEFAULT_MAX_EDGE,
        height: options.maxEdge ?? DEFAULT_MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      // Sharp strips EXIF, XMP, ICC and GPS metadata unless withMetadata is used.
      .jpeg({ quality: 88, mozjpeg: true, chromaSubsampling: "4:2:0" })
      .toBuffer();
  } catch {
    throw new UnsafeImageUploadError("The image could not be normalized safely", "invalid");
  }

  if (output.byteLength > (options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES)) {
    throw new UnsafeImageUploadError("The normalized image exceeds the storage limit", "output_too_large");
  }

  const normalizedMetadata = await sharp(output).metadata();
  return {
    bytes: output,
    mimeType: "image/jpeg" as const,
    extension: "jpg" as const,
    width: normalizedMetadata.width ?? metadata.width,
    height: normalizedMetadata.height ?? metadata.height,
    originalSha256: uploadSha256(bytes),
    storedSha256: uploadSha256(output),
    sourceMimeType: sniffedMime,
  };
}

export function normalizedImageFilename(filename: string | null | undefined, fallback: string) {
  const base = (filename || fallback)
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || fallback;
  return `${base}.jpg`;
}
