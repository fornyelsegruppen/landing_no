import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { verifyUploadTicket } from "@/lib/upload-ticket";
import {
  normalizedImageFilename,
  sanitizeImageUpload,
  UnsafeImageUploadError,
} from "@/lib/images/sanitize-upload";
import { captureException } from "@/lib/monitoring";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 4 * 1024 * 1024;

function asUploadBlob(value: FormDataEntryValue | null): Blob | null {
  if (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Blob).arrayBuffer === "function" &&
    typeof (value as Blob).size === "number" &&
    (value as Blob).size > 0
  ) {
    return value as Blob;
  }
  return null;
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Blob storage is not configured" },
      { status: 503 },
    );
  }

  const ip = clientIp(request);
  const limited = await rateLimit("photo-upload", ip, {
    limit: 30,
    windowSec: 60,
  });
  if (!limited.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const form = await request.formData();
    const ticket =
      (typeof form.get("ticket") === "string" ? form.get("ticket") : null) ||
      request.headers.get("x-upload-ticket");

    if (!verifyUploadTicket(typeof ticket === "string" ? ticket : null)) {
      return NextResponse.json(
        { error: "Invalid or expired upload ticket" },
        { status: 401 },
      );
    }

    const file = asUploadBlob(form.get("file"));
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: "File too large (max 4 MB after compression)" },
        { status: 413 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const normalized = await sanitizeImageUpload(bytes, {
      declaredMime: "type" in file ? file.type : null,
      maxInputBytes: MAX_BYTES,
    });
    const fileName =
      "name" in file && typeof file.name === "string" && file.name
        ? file.name
        : "photo.jpg";
    const safeName = normalizedImageFilename(fileName, "photo");

    const blob = await put(`leads/${Date.now()}-${safeName}`, normalized.bytes, {
      access: "private",
      token: process.env.BLOB_READ_WRITE_TOKEN,
      contentType: normalized.mimeType,
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      downloadUrl: blob.downloadUrl,
    });
  } catch (err) {
    if (err instanceof UnsafeImageUploadError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 415 });
    }
    captureException(err, { route: "POST /api/lead/photo-upload" });
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
