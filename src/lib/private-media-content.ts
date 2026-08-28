import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  BlobRequestAbortedError,
  BlobServiceNotAvailable,
  BlobServiceRateLimited,
  get,
} from "@vercel/blob";

export type PrivateMediaFile = {
  url?: string | null;
  filename?: string | null;
  mimeType?: string | null;
  filesize?: number | null;
};

const MAX_PRIVATE_MEDIA_BYTES = 15_000_000;
const PRIVATE_BLOB_ATTEMPTS = 2;
const PRIVATE_BLOB_RETRY_DELAY_MS = 150;
const PRIVATE_BLOB_TIMEOUT_MS = 8_000;

export class PrivateMediaTemporarilyUnavailableError extends Error {
  readonly code = "PRIVATE_MEDIA_TEMPORARILY_UNAVAILABLE";

  constructor() {
    super("Private media is temporarily unavailable");
    this.name = "PrivateMediaTemporarilyUnavailableError";
  }
}

function isTransientPrivateBlobError(error: unknown) {
  if (
    error instanceof BlobRequestAbortedError ||
    error instanceof BlobServiceNotAvailable ||
    error instanceof BlobServiceRateLimited
  ) {
    return true;
  }
  if (!(error instanceof Error)) return false;
  if (error.name === "AbortError" || error.name === "TimeoutError") return true;
  if (
    error instanceof TypeError &&
    [
      "Failed to fetch",
      "NetworkError when attempting to fetch resource.",
      "fetch failed",
      "network error",
      "terminated",
    ].includes(error.message)
  ) {
    return true;
  }
  return /Failed to fetch blob: (?:429|5\d\d)\b/i.test(error.message);
}

function wait(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

async function readPrivateBlob(url: string, token: string) {
  for (let attempt = 1; attempt <= PRIVATE_BLOB_ATTEMPTS; attempt += 1) {
    try {
      const result = await get(url, {
        access: "private",
        abortSignal: AbortSignal.timeout(PRIVATE_BLOB_TIMEOUT_MS),
        token,
      });
      if (!result?.stream || result.statusCode !== 200)
        throw new Error("Private media was not found");
      const data = Buffer.from(await new Response(result.stream).arrayBuffer());
      if (data.byteLength > MAX_PRIVATE_MEDIA_BYTES)
        throw new Error("Private media attachment is too large");
      return data;
    } catch (error) {
      if (!isTransientPrivateBlobError(error)) throw error;
      if (attempt < PRIVATE_BLOB_ATTEMPTS)
        await wait(PRIVATE_BLOB_RETRY_DELAY_MS);
    }
  }
  throw new PrivateMediaTemporarilyUnavailableError();
}

export async function readPrivateMediaContent(media: PrivateMediaFile) {
  if (!media.filename || !media.mimeType)
    throw new Error("Private media metadata is incomplete");
  if ((media.filesize ?? 0) > MAX_PRIVATE_MEDIA_BYTES)
    throw new Error("Private media attachment is too large");
  if (media.url) {
    const parsed = new URL(media.url);
    if (parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      if (!process.env.BLOB_READ_WRITE_TOKEN)
        throw new Error("Private Blob storage is not configured");
      const data = await readPrivateBlob(
        `${parsed.origin}${parsed.pathname}`,
        process.env.BLOB_READ_WRITE_TOKEN,
      );
      return { data, filename: media.filename, contentType: media.mimeType };
    }
  }
  const root = path.resolve(process.cwd(), "private-media");
  const filePath = path.resolve(root, media.filename);
  if (!filePath.startsWith(`${root}${path.sep}`))
    throw new Error("Invalid private media path");
  const data = await readFile(filePath);
  if (data.byteLength > MAX_PRIVATE_MEDIA_BYTES)
    throw new Error("Private media attachment is too large");
  return { data, filename: media.filename, contentType: media.mimeType };
}
