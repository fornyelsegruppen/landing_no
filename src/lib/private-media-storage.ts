import path from "node:path";
import { del, put } from "@vercel/blob";
import type { Payload } from "payload";
import type { PrivateMedia } from "@/payload/payload-types";

type PrivateMediaMetadata = Pick<
  PrivateMedia,
  "classification" | "ownerType" | "ownerId" | "alt"
>;

type PrivateMediaUpload = {
  data: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
};

function safeSegment(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "file";
}

/**
 * Payload's Vercel Blob adapter currently supports public stores only. Private
 * customer documents therefore use the Vercel Blob SDK directly and persist
 * only the protected object URL and upload metadata in Payload.
 */
export async function createPrivateMedia(
  payload: Payload,
  metadata: PrivateMediaMetadata,
  file: PrivateMediaUpload,
) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  const data = Buffer.from(file.data);
  const filename = safeSegment(file.filename);

  if (!token) {
    return payload.create({
      collection: "private-media",
      overrideAccess: true,
      data: metadata,
      file: {
        data,
        mimetype: file.mimeType,
        name: filename,
        size: data.byteLength,
      },
    });
  }

  const ownerType = safeSegment(metadata.ownerType || "unassigned");
  const ownerId = safeSegment(metadata.ownerId || "unassigned");
  const blob = await put(
    `private-media/${metadata.classification}/${ownerType}/${ownerId}/${filename}`,
    data,
    {
      access: "private",
      addRandomSuffix: true,
      contentType: file.mimeType,
      token,
    },
  );

  const storedFilename = decodeURIComponent(path.posix.basename(blob.pathname));
  try {
    return await payload.create({
      collection: "private-media",
      overrideAccess: true,
      data: {
        ...metadata,
        filename: storedFilename,
        mimeType: file.mimeType,
        filesize: data.byteLength,
        url: blob.url,
      },
    });
  } catch (error) {
    await del(blob.url, { token }).catch(() => undefined);
    throw error;
  }
}

export async function deletePrivateMedia(
  payload: Payload,
  media: Pick<PrivateMedia, "id" | "url">,
) {
  await payload.delete({
    collection: "private-media",
    id: media.id,
    overrideAccess: true,
  });

  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (token && media.url) {
    await del(media.url, { token }).catch(() => undefined);
  }
}
