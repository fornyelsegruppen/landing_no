import { readFile } from "node:fs/promises";
import path from "node:path";
import { get } from "@vercel/blob";

export type PrivateMediaFile = { url?: string | null; filename?: string | null; mimeType?: string | null; filesize?: number | null };

export async function readPrivateMediaContent(media: PrivateMediaFile) {
  if (!media.filename || !media.mimeType) throw new Error("Private media metadata is incomplete");
  if ((media.filesize ?? 0) > 15_000_000) throw new Error("Private media attachment is too large");
  if (media.url) {
    const parsed = new URL(media.url);
    if (parsed.hostname.endsWith(".blob.vercel-storage.com")) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("Private Blob storage is not configured");
      const result = await get(`${parsed.origin}${parsed.pathname}`, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
      if (!result?.stream || result.statusCode !== 200) throw new Error("Private media was not found");
      const data = Buffer.from(await new Response(result.stream).arrayBuffer());
      if (data.byteLength > 15_000_000) throw new Error("Private media attachment is too large");
      return { data, filename: media.filename, contentType: media.mimeType };
    }
  }
  const root = path.resolve(process.cwd(), "private-media");
  const filePath = path.resolve(root, media.filename);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error("Invalid private media path");
  const data = await readFile(filePath);
  if (data.byteLength > 15_000_000) throw new Error("Private media attachment is too large");
  return { data, filename: media.filename, contentType: media.mimeType };
}
